"""Local-only reward entitlement proof-of-concept for Unfire Audio.

NOT a live checkout, App Store transaction verifier or prize delivery service.
All operations fail CLOSED unless requirements in promo-status.json are approved.
No customer PII is persisted; references are HMACed with a secret NEVER committed.
"""
from __future__ import annotations
import hmac
import hashlib
import json
import secrets
import sqlite3
import time
from pathlib import Path

PROMO_FILE = Path(__file__).resolve().parents[2] / 'audio/halloween/promo-status.json'

class PromotionUnavailable(Exception): pass
class DuplicatePurchase(Exception): pass
class UsedCode(Exception): pass
class NoPrizesAvailable(Exception): pass

class PromoLedger:
    def __init__(self, db_path, secret: bytes, manifest_path=PROMO_FILE, *, testing=False):
        if not isinstance(secret, bytes) or len(secret) < 32:
            raise ValueError('A secure random 32+ byte server secret is required')
        self.secret = secret
        self.manifest_path = Path(manifest_path)
        self.testing = testing
        self.con = sqlite3.connect(db_path, timeout=25, isolation_level=None)
        self.con.execute('PRAGMA busy_timeout=25000')
        self.con.execute('PRAGMA foreign_keys=ON')
        self.con.executescript('''
            CREATE TABLE IF NOT EXISTS coupons(
                promo_id TEXT NOT NULL, purchase_digest TEXT NOT NULL,
                sku TEXT NOT NULL, token_digest TEXT NOT NULL UNIQUE,
                created_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
                redeemed_at INTEGER,
                PRIMARY KEY(promo_id,purchase_digest));
            CREATE TABLE IF NOT EXISTS prizes(
                sku TEXT PRIMARY KEY, remaining INTEGER NOT NULL CHECK(remaining>=0),
                weight INTEGER NOT NULL CHECK(weight>0));
            CREATE TABLE IF NOT EXISTS spins(
                campaign_id TEXT NOT NULL, entrant_digest TEXT NOT NULL,
                prize_sku TEXT NOT NULL, spun_at INTEGER NOT NULL,
                PRIMARY KEY(campaign_id,entrant_digest),
                FOREIGN KEY(prize_sku) REFERENCES prizes(sku));
        ''')

    def close(self): self.con.close()

    def _digest(self, scope: str, identifier: str):
        if not isinstance(identifier,str) or not 4 <= len(identifier) <= 1024:
            raise ValueError('Invalid identifier')
        return hmac.new(self.secret, (scope+'\x00'+identifier).encode(), hashlib.sha256).hexdigest()

    def _gate(self, kind):
        status=json.loads(self.manifest_path.read_text(encoding='utf8'))
        record=status[kind]
        if self.testing:
            return record
        if kind=='archer_unique_buyer_code':
            authorized=all((record.get('enabled'),record.get('purchase_verification_backend_ready'),record.get('fulfillment_and_redemption_verified',False)))
        elif kind=='halloween_plugin_prize_wheel':
            authorized=all((record.get('enabled'),record.get('local_promotional_filing_verified'),record.get('prize_plugins_fulfillable'),record.get('rules_published'),record.get('server_and_inventory_verified',False)))
        else:authorized=False
        if not authorized: raise PromotionUnavailable('The promotional entitlement is not legally and technically authorized')
        return record

    def issue_one_time_code(self, *, purchase_reference, sku, verified_receipt=False, now=None, ttl_days=14):
        status=self._gate('archer_unique_buyer_code')
        if not verified_receipt:raise PromotionUnavailable('A verified Apple purchase is required')
        if sku not in ('archer-mac','archer-ios'):raise ValueError('Unsupported source purchase SKU')
        if not self.testing and sku not in status.get('approved_source_skus',[]):
            raise PromotionUnavailable('SKU has not been authorized')
        if not 1 <= ttl_days <= 90:raise ValueError('Invalid validity period')
        now=int(time.time() if now is None else now)
        purchase_digest=self._digest('purchase:'+sku,purchase_reference)
        code='UFH-'+secrets.token_urlsafe(24)
        token_digest=self._digest('coupon',code)
        self.con.execute('BEGIN IMMEDIATE')
        try:
            self.con.execute('INSERT INTO coupons VALUES(?,?,?,?,?,?,NULL)',
                ('archer-halloween-2026',purchase_digest,sku,token_digest,now,now+ttl_days*86400))
            self.con.execute('COMMIT')
        except sqlite3.IntegrityError as e:
            self.con.execute('ROLLBACK')
            raise DuplicatePurchase('Only one issued code per verified purchase') from e
        except Exception:
            self.con.execute('ROLLBACK');raise
        return code # Delivered once; never stored in clear text

    def redeem_one_time_code(self, code, *, now=None):
        self._gate('archer_unique_buyer_code')
        now=int(time.time() if now is None else now)
        token_digest=self._digest('coupon',code)
        self.con.execute('BEGIN IMMEDIATE')
        try:
            row=self.con.execute('SELECT sku, expires_at, redeemed_at FROM coupons WHERE token_digest=?',(token_digest,)).fetchone()
            if not row or row[2] is not None or now>row[1]:raise UsedCode('Unknown, expired or redeemed')
            result=self.con.execute('UPDATE coupons SET redeemed_at=? WHERE token_digest=? AND redeemed_at IS NULL',(now,token_digest))
            if result.rowcount!=1:raise UsedCode('Already redeemed')
            self.con.execute('COMMIT')
            return {'source_sku':row[0],'verified_only':True,'fulfillment':'not_implemented'}
        except Exception:
            self.con.execute('ROLLBACK');raise

    def set_prize_inventory(self, sku, quantity, weight):
        # Testing tool only; actual inventory needs fulfillment and legal sign-off.
        if not self.testing:raise PromotionUnavailable('Prize inventory cannot be loaded from an unverified UI')
        if not 0<=quantity<=10000 or not 1<=weight<=1000:raise ValueError('Bad prize inventory')
        self.con.execute('INSERT INTO prizes(sku,remaining,weight) VALUES(?,?,?) ON CONFLICT(sku) DO UPDATE SET remaining=excluded.remaining,weight=excluded.weight',(sku,quantity,weight))

    def spin_once(self, *, campaign_id, entrant_reference, now=None):
        status=self._gate('halloween_plugin_prize_wheel')
        if not campaign_id or len(campaign_id)>100:raise ValueError('Invalid campaign')
        now=int(time.time() if now is None else now)
        entrant_digest=self._digest('entrant:'+campaign_id,entrant_reference)
        self.con.execute('BEGIN IMMEDIATE')
        try:
            if self.con.execute('SELECT 1 FROM spins WHERE campaign_id=? AND entrant_digest=?',(campaign_id,entrant_digest)).fetchone():
                raise DuplicatePurchase('This entrant already took part')
            rows=self.con.execute('SELECT sku,weight FROM prizes WHERE remaining>0 ORDER BY sku').fetchall()
            if not self.testing:rows=[r for r in rows if r[0] in status.get('approved_prize_skus',[])]
            if not rows:raise NoPrizesAvailable('No verified prizes available')
            total=sum(r[1] for r in rows)
            draw=secrets.randbelow(total)
            chosen=rows[-1][0]
            for sku,weight in rows:
                if draw<weight:
                    chosen=sku;break
                draw-=weight
            if self.con.execute('UPDATE prizes SET remaining=remaining-1 WHERE sku=? AND remaining>0',(chosen,)).rowcount!=1:
                raise NoPrizesAvailable('Prize inventory exhausted')
            self.con.execute('INSERT INTO spins VALUES(?,?,?,?)',(campaign_id,entrant_digest,chosen,now))
            self.con.execute('COMMIT')
            return {'prize_sku':chosen,'allocation_only':True,'delivered':False}
        except Exception:
            self.con.execute('ROLLBACK');raise
