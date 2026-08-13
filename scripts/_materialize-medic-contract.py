from pathlib import Path
p=Path('src/games/monster-master/repository-contract.test.ts')
s=p.read_text()
needle='test("Medic is an unassigned Monster Master trainer asset-library archetype"'
if needle not in s:
 block=Path('scripts/_medic-contract-a.txt').read_text()+Path('scripts/_medic-contract-b.txt').read_text()
 marker='test("standalone Arena enters combat after all eight combatants deploy"'
 s=s.replace(marker,block+marker,1)
p.write_text(s)
