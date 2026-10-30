# Unfire Atlas · Multiscale Topology Lab

**Research-only · Offline · Reproducible · No connected agents**

This deliberately small experiment translates an analogy into a falsifiable engineering question: **How do different communication topologies trade link count, path length, relay concentration and resilience?**

## Scientific context and boundaries

- Earth is a system of interacting atmosphere, hydrosphere, cryosphere, geosphere and biosphere, but **not literally a biological cell**. [NASA Earth System Science](https://science.nasa.gov/earth-science/research/)
- Biological systems can be mapped as networks at multiple scales, but hierarchy is not inherently superior. [Cell Systems review](https://pubmed.ncbi.nlm.nih.gov/34139169/)
- The cosmic-web / neuronal-network comparison reports some statistical similarities. It **does not establish that the universe is a brain or conscious organism**. [Vazza and Feletti, 2020](https://doi.org/10.3389/fphy.2020.525731)
- Biological inspiration has been used to infer aspects of the cosmic web, as reported by NASA. This is inspiration for a **mathematical algorithm**, not evidence of identical mechanisms. [NASA/Hubble](https://science.nasa.gov/asset/hubble/cosmic-web-and-slime-mold/)
- Networks trade resilience against wiring and concentration of failures. [Nature Reviews Physics](https://doi.org/10.1038/s42254-023-00676-y)

## What the executable model compares

Twenty-four synthetic workers arranged in four groups of six, plus one synthetic coordinator node. Same 25 vertices in each topology.

| Design | Structure | Links |
| --- | --- | ---: |
| Hub | All workers connect through coordinator | 24 |
| Hierarchy | Each group communicates through a designated leader; leaders connect to coordinator | 24 |
| Regional | Each group forms a full local mesh; group leaders connect to coordinator | 64 |
| Mesh | All nodes connected to every other | 300 |

The seed creates 2,400 deterministic synthetic worker-to-worker messages, with a configurable fraction of intra-group messages. The simulator measures links, delivered fraction, mean route hops, total transmissions, load at the central coordinator, highest relay load, and delivery after deleting the coordinator or one group leader.

**Important:** A message here is a mathematical graph route, **not** a real API or message exchange. Link count is not real deployment cost, hops are not latency, forwarding is not CPU/GPU usage, root failure is not a security test, and the design does not authorize network, OS, model, agent, or device access. The work does not claim any topology is universally best.

## Run

From this directory with Node.js (no packages or network):

```sh
node --test model.test.mjs
node -e 'import("./model.mjs").then(m => console.log(JSON.stringify(m.compare(),null,2)))'
```

## Engineering hypothesis for the owner of Unfire OS #247

When most tasks communicate within small teams, selective local connections may lower coordinator load. Redundant local connectivity may maintain team-level work when a global coordinator disappears. A fully connected mesh may reduce routes but requires many links. Every result depends on traffic patterns and the failure model; a hierarchy can concentrate failures at its group leaders.

**Use in Unfire OS:** research evidence only. Real adoption requires a replayable benchmark of actual agent/event workloads, permission-bound identities, measured resources, transparent failure recovery, and a security review. Do not edit the occupied Unfire OS prototype (#248) or its QA child PR (#250) based on this alone.

No private data, external requests, subscriptions, background tasks or new live processes.