#!/usr/bin/env node

var fs       = require('fs'),
    graphviz = require('graphviz'),
    Graph = require("@dagrejs/graphlib").Graph,
    colormap = require('colormap');
 

if (!process.argv[2]) {
  console.log("hflow-dot: converts HyperFlow workflow.json to graphviz dot format");
  console.log("Usage: hflow-dot <workflow.json path>");
  process.exit();
}

var file = process.argv[2];

var fileContents = fs.readFileSync(file);

var wf = JSON.parse(fileContents);

var g = graphviz.digraph("G");

var signals   = (wf.data      || wf.signals);
var processes = (wf.processes || wf.tasks);

var sigMap    = {};
signals.forEach(function(sig, ix) {
  sigMap[sig.name] = ix;
});

var sigToId = function(sig) {
  if(!isNaN(parseInt(sig))) { 
    return sig;
  } else {
    return sigMap[sig];
  }
};

// first use the Graph lib to build a full workflow graph
var wfgraph = new Graph();

var procNames = {}; // for colormap
processes.forEach(function(proc, idx) {
  wfgraph.setNode("p:"+(idx+1), proc.name);
  procNames[proc.name]="1";
});
var procNamesArray = Object.keys(procNames);
procNamesArray.forEach((pn, idx) => procNames[pn]=idx); // map name to index

signals.forEach(function(sig, idx) {
  wfgraph.setNode("s:"+(idx+1), sig.name);
});
processes.forEach(function(proc, idx) {
  (proc.ins||[]).forEach(function(insig) {
    wfgraph.setEdge("s:"+insig, "p:"+(idx+1));
  });
  (proc.outs||[]).forEach(function(outsig) {
    wfgraph.setEdge("p:"+(idx+1), "s:"+outsig)
  });
});

let cmap = procNamesArray.length > 10 ? 'rainbow-soft': 'jet';
if (procNamesArray.length < 6) { cmap = 'autumn'; }
let colors = colormap({
    colormap: cmap,
    nshades: procNamesArray.length,
    format: 'hex',
    alpha: 1
});

// then build a smaller graph with only processes (better for visualization)
var procg = new Graph();

processes.forEach(function(proc, idx) {
  procg.setNode("p:"+(idx+1), proc.name);
});
processes.forEach(function(proc, idx) {
  var children = wfgraph.successors("p:"+(idx+1)).flatMap(x => wfgraph.successors(x));
  children.map(ch => procg.setEdge("p:"+(idx+1), ch));
});

// finally build the graphviz graph and save it
procg.nodes().forEach(function(proc, idx) {
  var n = g.addNode(proc);
  var name = procg.node(proc);
  n.set('label', name);
  n.set('color', colors[procNames[name]]);
  n.set('style', 'filled');
  procg.successors(proc).forEach(function(succ) {
    g.addEdge(proc, succ);
  });
});

fs.writeFileSync(file + ".dot", g.to_dot());
