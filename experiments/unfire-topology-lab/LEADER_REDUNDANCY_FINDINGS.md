# Atlas · Leader Redundancy Without Unrestricted Connectivity

**Status:** deterministic, offline graph-model experiment. Research only. NOT a deployed AI runtime, security guarantee, throughput benchmark, physical network measurement, consciousness hypothesis, or basis for a production merge.

## Research question

Can a small amount of *local* redundancy prevent single-team-leader failure from partitioning its coworkers, and can selective inter-team failover maintain their connectivity after a leader or coordinator fails? What is the additional connection and cross-team exposure cost?

## Synthetic architecture (unchanged baseline)

- 25 vertices: 24 synthetic worker vertices grouped into four teams of six, plus one synthetic central coordinator (vertex 24).
- The original 28-link leader-ring connects each primary team leader to five coworkers and to the coordinator, and the four primary leaders to each other in a ring.
- Backup per team: the worker immediately following its team leader (vertices 1, 7, 13, 19). In the model, a backup means **redundant graph connectivity**, not another AI agent with permissions or any automatic promotion authority.
- Additional group-local links: backup to the four non-backup/non-leader members, 16 new undirected links in total.
- Optional forward bridge: one backup-to-next-team-leader link per team (4 more links); optional dual bridge: also one backup-to-previous-team-leader link per team (4 further links).
- Fully connected mesh is a reference upper-bound topology. It is not a deployment recommendation.

| Synthetic design | Undirected links | Direct cross-team worker links |
| --- | ---: | ---: |
| Original leader ring | 28 | 4 |
| Local backup only | 44 | 4 |
| Local backup + one external bridge | 48 | 8 |
| Local backup + two external bridges | 52 | 12 |
| Full 25-node mesh | 300 | 216 |

Cross-team links are a **trust-boundary surface proxy**, not a security vulnerability count. Real authority must never derive from these undirected edges; access-control, authentication, confidentiality and explicit capability restrictions remain mandatory.

## Fixed synthetic tests (seed 20261030)

**Fault experiments:** every one of 300 possible distinct pairs of deleted vertices, with 180 predetermined synthetic worker-to-worker messages and nominal within-team traffic probability 85%. Delivery denominator includes messages involving deleted workers; this is a toy robustness metric, not actual uptime. **No processing capacity or security permissions are modeled in fault averages.**

| Design | Mean delivery, 300 failure pairs | Worst case |
| --- | ---: | ---: |
| Leader ring | 78.18% | 38.33% |
| Local backup | 82.14% | 64.44% |
| Backup + forward bridge | 84.05% | 64.44% |
| Backup + dual bridge | 84.14% | 64.44% |
| Full mesh | 84.33% | 75.00% |

The **worst case remains 64.44%** across all three backup designs because losing the original leader and its backup still isolates some other team members in this graph. Adding more inter-team links fails to solve this local problem.

### Explicit failure cases

The following percentages are *among messages whose two worker endpoints remain alive*, using 2,400 deterministic messages at nominal 85% team-local traffic.

| Design | Leader 0 gone | Coordinator + leader 0 gone | Leaders 0 + 6 gone | Leader 0 + backup 1 gone |
| --- | ---: | ---: | ---: | ---: |
| Leader ring | 75.83% | 75.83% | 52.74% | 82.86% |
| Local backup | 92.57% | 92.57% | 87.12% | 82.86% |
| Forward bridge | 100% | 100% | 92.20% | 82.86% |
| Dual bridge | 100% | 100% | 100% | 82.86% |
| Full mesh | 100% | 100% | 100% | 100% |

### Quota-limited routing stress

A link has a **total use budget for one sequential batch**, with shortest-available-path routing. This is not bandwidth, parallel concurrency, real latency, CPU load or monetary cost. 2,400 seeded messages, no failed vertices.

| Design | Delivered, quota 24 | Delivered, quota 96 | Delivered, quota 256 |
| --- | ---: | ---: | ---: |
| Leader ring | 311 | 1,182 | 2,400 |
| Local backup | 577 | 2,160 | 2,400 |
| Forward bridge | 628 | 2,272 | 2,400 |
| Dual bridge | 667 | 2,272 | 2,400 |
| Full mesh | 2,400 | 2,400 | 2,400 |

A larger graph has more links to administrate and potentially protect. It can also distribute synthetic traffic more effectively in this very particular model. Extra edges can create new paths for lateral propagation unless real permission boundaries are enforced. The model cannot prove any system is safe or fast.

## Reproducibility

```sh
cd experiments/unfire-topology-lab
node --test model.test.mjs ring-experiment.test.mjs capacity-failure.test.mjs leader-redundancy.test.mjs
```

Node v22.16.0 local isolated execution on 30 Oct 2026: **47 tests passed, 0 failed** (existing 31 plus 16 new tests), including alternative traffic-locality settings, seeded reproducibility, 300 two-failure combinations per design, authorization-free graph limitations, message conservation, bounded-edge-use tests and honest simulation labeling. These are local results until separately confirmed on the exact committed GitHub revision; do not conflate with CI.

## Decision

**Promising research, not ready for Unfire OS.** Of the sparse options, one forward bridge looks attractive for selected failures, while two bridges add lateral cross-team links for much smaller improvements in mean pair survival. Neither solves the co-failure of the main leader and its backup. A more realistic experiment should introduce directional authenticated channels, independent approval boundaries, delays/queues, load balancing and disconnected-mode semantics before any operational architecture decision. Compare against a simple non-hierarchical reference using the same workload and costs. There is no basis to connect real agents, modify apps or automatically take external actions.
