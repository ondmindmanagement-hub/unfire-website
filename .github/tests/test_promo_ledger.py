import importlib.util
import pathlib
import secrets
import sqlite3
import tempfile
import unittest
import json

F=pathlib.Path(__file__).resolve().parents[1]/'operations'/'promo_ledger.py'
spec=importlib.util.spec_from_file_location('unfire_promo_ledger',F)
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)

class PromoTest(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=pathlib.Path(self.tmp.name)/'private.sqlite'
        self.conf=pathlib.Path(self.tmp.name)/'status.json'
        self.conf.write_text(json.dumps({
            'archer_unique_buyer_code':{'enabled':False,'purchase_verification_backend_ready':False},
            'halloween_plugin_prize_wheel':{'enabled':False,'local_promotional_filing_verified':False,
                'prize_plugins_fulfillable':False,'rules_published':False}
        }))
        self.secret=secrets.token_bytes(32)
    def tearDown(self):self.tmp.cleanup()
    def ledger(self, testing=False):return m.PromoLedger(str(self.db),self.secret,self.conf,testing=testing)
    def test_production_cannot_issue_or_spin_or_load_prizes(self):
        db=self.ledger()
        with self.assertRaises(m.PromotionUnavailable):db.issue_one_time_code(purchase_reference='transaction-1',sku='archer-mac',verified_receipt=True)
        with self.assertRaises(m.PromotionUnavailable):db.spin_once(campaign_id='halloween',entrant_reference='user001')
        with self.assertRaises(m.PromotionUnavailable):db.set_prize_inventory('fx1',1,1)
        self.assertEqual(db.con.execute('SELECT COUNT(*) FROM coupons').fetchone()[0],0)
        db.close()
    def test_single_use_code_and_dedup_purchase(self):
        db=self.ledger(testing=True)
        with self.assertRaises(m.PromotionUnavailable):db.issue_one_time_code(purchase_reference='transaction-1',sku='archer-mac')
        code=db.issue_one_time_code(purchase_reference='transaction-1',sku='archer-mac',verified_receipt=True,now=100)
        self.assertTrue(code.startswith('UFH-'))
        with self.assertRaises(m.DuplicatePurchase):db.issue_one_time_code(purchase_reference='transaction-1',sku='archer-mac',verified_receipt=True,now=101)
        self.assertNotIn('transaction-1',str(db.con.execute('SELECT * FROM coupons').fetchone()))
        self.assertNotIn(code,str(db.con.execute('SELECT * FROM coupons').fetchone()))
        self.assertEqual(db.redeem_one_time_code(code,now=110)['source_sku'],'archer-mac')
        with self.assertRaises(m.UsedCode):db.redeem_one_time_code(code,now=111)
        db.close()
    def test_expiry_and_validation(self):
        db=self.ledger(testing=True)
        with self.assertRaises(ValueError):db.issue_one_time_code(purchase_reference='test',sku='todo',verified_receipt=True)
        code=db.issue_one_time_code(purchase_reference='transaction-2',sku='archer-ios',verified_receipt=True,now=50,ttl_days=1)
        with self.assertRaises(m.UsedCode):db.redeem_one_time_code(code,now=86451)
        db.close()
    def test_one_spin_only_no_infinite_prizes(self):
        db=self.ledger(testing=True)
        db.set_prize_inventory('fxA',1,10)
        db.set_prize_inventory('fxB',1,10)
        picks={db.spin_once(campaign_id='halloween2026',entrant_reference='person0'+str(i))['prize_sku'] for i in range(2)}
        self.assertEqual(picks,{'fxA','fxB'})
        with self.assertRaises(m.DuplicatePurchase):db.spin_once(campaign_id='halloween2026',entrant_reference='person00')
        with self.assertRaises(m.NoPrizesAvailable):db.spin_once(campaign_id='halloween2026',entrant_reference='person03')
        self.assertEqual(db.con.execute('SELECT SUM(remaining) FROM prizes').fetchone()[0],0)
        db.close()
    def test_bad_key_rejected(self):
        with self.assertRaises(ValueError):m.PromoLedger(str(self.db),b'123',self.conf)

if __name__=='__main__':unittest.main()
