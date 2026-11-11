# Atlas · Dual-failure and bounded-link research

**Status: isolated mathematical simulation, not an AI network, published product, or measured reliability/security/latency.**

## The engineering question

Do sparse inter-team links still help when more than one node fails or when every communication channel can carry only a limited number of messages during the simulated batch? Compare six graph layouts using the same task/message fixtures.

## Model assumptions

- Six pre-existing layouts: 24-worker star hub (24 links), strict hierarchy (24), regional local mesh (64), global full mesh (300), hierarchy with 4-leader ring (28), regional mesh with 4-leader ring (68). Every layout also has one root coordinator node, giving 25 total nodes.
- Messages are synthetic directed worker-to-worker origin/destination pairs, seeded deterministically. Delivery is one shortest currently available undirected path, with increasing-node-ID tie breaking.
- A **link-capacity quota** is a fixed count of total transmissions per undirected link for **one batch**, shared by both directions. The quota is not bandwidth per second, a real congestion controller, or a model of CPU, API tokens, scheduling costs or delay. The greedy routing order is fixed and can change outcomes.
- Failure removes up to two vertices. If a message's source/destination is removed, it is counted as an endpoint loss, not a partition. Other failures are classified as disconnected or over budget. The model has no waiting, queueing, retries or adaptive traffic shaping.
- 300 possible distinct two-node failures per graph, including root or worker failures (25 choose 2). The broad failure experiment uses 180 synthetic messages for each pair, seed 20261030 and nominal 85% intra-team traffic. The capacity experiment uses 2,400 messages, seed 20261030 and two locality mixes, 15% and 85% nominal local traffic.

## Result A · two simultaneous node failures

Average and worst successful message delivery across all 300 two-vertex failure combinations. **The denominator includes messages whose original endpoints were among the removed nodes.** Consequently even a full mesh cannot achieve 100% under node loss. These are not survival probabilities or an availability SLO.

| Topology | Links | Mean delivered | Worst delivered | One worst removed-node pair |
| --- | ---: | ---: | ---: | --- |
| Hub | 24 | 77.00% | 0.00% | [0,24] includes coordinator |
| Hierarchy | 24 | 76.93% | 38.33% | [0,6] two group leaders |
| Regional | 64 | 81.00% | 68.89% | [0,8] |
| Full mesh | 300 | 84.33% | 75.00% | [3,8] removed endpoints only |
| Hierarchy + ring | 28 | 78.18% | 38.33% | [0,6] two group leaders |
| Regional + ring | 68 | 82.25% | 68.89% | [0,8] |

**Finding:** The four-edge ring improves average double-failure results somewhat, but does **not** raise the worst case for this failure model. A ring does not solve the local-group-leader problem. For comparison, with root AND group-leader 0 removed from the 2,400-message batch, hierarchy ring delivers 1,653/2,400 (68.88%): 220 losses are to removed endpoints and 527 are disconnected routes. Regional ring delivers 2,018/2,400 (84.08%): 220 removed endpoints and 162 disconnected routes. These are toy graph outcomes.

## Result B · fixed link quotas, 85% nominal local traffic

Delivered percentage among the 2,400 synthetic messages for link budget 24, 96, 256 or unlimited uses per undirected link for the entire batch, with no deleted nodes.

| Topology | 24/link | 96/link | 256/link | Unlimited |
| --- | ---: | ---: | ---: | ---: |
| Hub | 11.92% | 47.71% | 100% | 100% |
| Hierarchy | 12.54% | 49.17% | 100% | 100% |
| Regional | 55.04% | 92.71% | 100% | 100% |
| Full mesh | 100% | 100% | 100% | 100% |
| Hierarchy + ring | 12.96% | 49.25% | 100% | 100% |
| Regional + ring | 53.00% | 100% | 100% | 100% |

**Negative result, important:** With quota 24, adding the four ring links makes the regional layout **worse** (55.04% -> 53.00%), despite improving root-loss connectivity. With quota 96, the ring improves delivery (92.71% -> 100%). This does not prove extra links harm or help a real system; it shows our greedy routing and bottleneck limits matter.

## Result C · limited links, 15% nominal local traffic

| Topology | 24/link | 96/link | 256/link | Unlimited |
| --- | ---: | ---: | ---: | ---: |
| Hub | 12.00% | 47.96% | 100% | 100% |
| Hierarchy | 11.96% | 22.75% | 35.96% | 100% |
| Regional | 16.92% | 22.75% | 35.96% | 100% |
| Full mesh | 100% | 100% | 100% | 100% |
| Hierarchy + ring | 11.92% | 34.54% | 68.21% | 100% |
| Regional + ring | 19.83% | 34.54% | 68.21% | 100% |

When most traffic crosses team boundaries, all schemes with a small number of cross-team links encounter substantial bottlenecks. These results are highly dependent on the synthetic traffic mix and budget model.

### Repeatability check across four independent seeds

For seeds 1, 42, 20261030 and 271828 at quota 24, nominal 85% local traffic, regional delivers on average 55.23% (range 54.6–55.6%), while regional+ring delivers 52.96% (range 52.5–53.4%). At quota 96, corresponding means are 92.90% (91.9–94.1%) vs 100%. Four seeds are a small diagnostic set, not a statistical uncertainty guarantee.

## Recommendation · no OS change yet

**Do not declare the ring the new Unfire OS network default.** It addresses central-coordinator removal in a simplified model but leaves local-leader bottlenecks. Next research should compare local leader redundancy, backup routing under authorization boundaries, weighted channel limits, explicit queueing, runtime costs and measured task-event traces. A real extra link changes the trust boundary and needs explicit security review. This branch remains research-only and must not merge or deploy itself.

## Reproduction

No dependencies or network required. From `experiments/unfire-topology-lab`:

```sh
node --test model.test.mjs ring-experiment.test.mjs capacity-failure.test.mjs
node --input-type=module -e 'import {evaluatePairs,capacitySweep} from "./capacity-failure.mjs"; console.log(JSON.stringify({failures:evaluatePairs(),capacity:capacitySweep()},null,2))'
```

**Local evidence at authoring:** Node 22.16.0, 31/31 tests passing across three suites, including 11 new test groups, six topology designs and all 300 two-node failure pairs. A new GitHub/CI run is not claimed unless separately verified at the resulting branch SHA.

Scope: `#247` Unfire OS research, `#242` performance acceptance, draft PR #251, no direct source modifications to #248 or #250.