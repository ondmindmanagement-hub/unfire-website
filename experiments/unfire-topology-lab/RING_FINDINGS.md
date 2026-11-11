# Atlas · Selective Ring Links · Synthetic Research Findings

**Research only. Not an AI runtime, real network, physical fault test, production reliability report or demonstrated speedup.**

## Hypothesis

Adding a sparse four-edge ring between team leaders may preserve routing after central coordinator failure without creating a complete mesh.

## Experimental setup

The original graph has 24 synthetic workers in four groups and one root coordinator. This extension adds undirected edges 0–6, 6–12, 12–18 and 18–0 to the hierarchy or regional layout. All routes use deterministic shortest paths and neighbor-ID tie breaking. No link congestion, bandwidth, compute, queues, authentication, trust, costs or real failures are modeled.

- 2,400 repeatable directed worker-to-worker messages, seed 20261030.
- 0%, 50%, 85%, 100% nominal within-team traffic probabilities.
- Metrics: link count, mean mathematical route hops, coordinator relays, reachable messages after coordinator or first group leader loss.

## Observed output for 85% nominal local traffic

| Topology | Links | Mean hops | Coordinator relays | Delivery after root loss | Delivery after leader 0 loss |
| --- | ---: | ---: | ---: | ---: | ---: |
| Hub | 24 | 2.000 | 2,400 | 0.00% | 90.83% |
| Hierarchy | 24 | 1.964 | 367 | 84.71% | 68.88% |
| Regional | 64 | 1.402 | 367 | 84.71% | 84.08% |
| Full mesh | 300 | 1.000 | 0 | 100.00% | 90.83% |
| Hierarchy + leader ring | 28 | 1.869 | 0 | 100.00% | 68.88% |
| Regional + leader ring | 68 | 1.307 | 0 | 100.00% | 84.08% |

These are **synthetic model outputs, not measured latency, money spent, security or resilience**. Nominal locality is the probability in the generator, not an exact fraction of samples. Zero observed coordinator relays results from the shortest-path algorithm's routing and tie breaking; it does not mean a real coordinator is redundant.

### After root removal, different message mixes

| Nominal local traffic | Hierarchy | Hierarchy + ring | Regional + ring |
| --- | ---: | ---: | ---: |
| 0% | 0.00% | 100% | 100% |
| 50% | 50.04% | 100% | 100% |
| 85% | 84.71% | 100% | 100% |
| 100% | 100% | 100% | 100% |

The ring maintains graph connectivity after **one specific failure: deletion of the root node**. It does not prevent isolation of workers when their group leader fails. Under nominal 85% local traffic, losing leader 0 still leaves only 68.88% of messages deliverable in the hierarchy and hierarchy-ring variants. The regional-ring reduces local leader exposure but does not remove it. Full mesh has the shortest routes, but at more than ten times the 28-link ring's edge count.

## Validation gate

Treat this as a design candidate, not an architecture mandate. Before any adoption in Unfire OS #247 / #248, model weighted/limited channels, actual task-event traffic, consent and scoped identity, adversarial sources, multiple failures, queues, coordination and resource overhead. Additional links can expand a security boundary.

Run with Node.js from this folder:
- node --test model.test.mjs ring-experiment.test.mjs
- node --input-type=module -e 'import {compareRing} from "./ring-experiment.mjs"; console.log(JSON.stringify(compareRing(),null,2))'

No real agent, OS or remote execution. No release or merge permitted by this research alone.
