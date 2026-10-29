import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCanopy,branchPoint,trunkPoint,twigPoint } from '../src/renderer/canopy';

test('seeded canopy has connected branch and twig nodes with attached leaves',()=>{
  const a=buildCanopy(1402),b=buildCanopy(1402);assert.deepEqual(a,b);assert.equal(a.length,4);
  const u=720,h=1080;
  for(const branch of a){
    const trunk=trunkPoint(u,h,branch.trunkT),root=branchPoint(branch,u,0);
    assert.ok(Math.abs(root.x)<1e-9&&Math.abs(root.y)<1e-9);assert.ok(Number.isFinite(trunk.x)&&Number.isFinite(trunk.y));
    assert.equal(branch.twigs.length,8);
    for(const twig of branch.twigs){
      assert.ok(twig.t>0&&twig.t<1);assert.ok(Math.abs(twigPoint(twig,u,0).x)<1e-9&&Math.abs(twigPoint(twig,u,0).y)<1e-9);
      const joint=branchPoint(branch,u,twig.t);assert.ok(Number.isFinite(joint.x)&&Number.isFinite(joint.y));
      assert.equal(twig.leaves.length,3);assert.equal(twig.leaves[2].t,1);
      for(const leaf of twig.leaves){assert.ok(leaf.t>0&&leaf.t<=1);const node=twigPoint(twig,u,leaf.t);assert.ok(Number.isFinite(node.x)&&Number.isFinite(node.y));}
      assert.notEqual(twig.leaves[0].side,twig.leaves[1].side);
    }
  }
});
