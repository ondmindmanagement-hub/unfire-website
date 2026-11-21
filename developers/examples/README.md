# Unfire Developer Platform: synthetic approval-gate reference

This is a **dependency-free, local-only teaching example**, not an official production SDK, a public API, a connection to Bolt or Control, or a secure authorisation service.

## Run

Requires Node.js 18 or later.

```sh
node --test approval-gate.test.mjs
```

Inspect `approval-gate.mjs`: `evaluateAction(action, approvalIds)` decides **deny**, **review**, or **allow** only for synthetic inputs. In this demonstration, permitted actions are inert; **nothing is executed**. `appendRecord` returns a new in-memory list and freezes each added record.

## Security limitations

- `approvalIds` is a local example parameter, **not proof of human identity or consent**. A real system needs trusted authentication, policy enforcement, revocation, expiry and audit integrity.
- These records are neither durable nor tamper-evident. There is no cryptographic signature, filesystem writer or network backend.
- The module does not measure AI tokens/cost, connect to models, implement rollback or control real applications.
- **Do not use this code to protect real money, people, production credentials, healthcare systems or critical infrastructure.**

## Rights

Only the files in `developers/examples/` are released under the local [MIT licence](LICENSE.txt). No licence to distribute actual Unfire Bolt / Control source, product names or assets is implied.

For actual developer access, see [Unfire Developer Platform](https://unfire.technology/developers/) after the public release is confirmed.
