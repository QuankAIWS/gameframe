from pathlib import Path
p=Path('public/assets/monster-master/manifest.json')
s=p.read_text()
source='    "approved-medic-trainer-isometric-master-v1",\n'
if source not in s:
 s=s.replace('    "approved-arcanic-trainer-isometric-master-v1",\n','    "approved-arcanic-trainer-isometric-master-v1",\n'+source,1)
entry='''    "medic-trainer-v1": {
      "label": "Medic",
      "archetype": "medic",
      "path": "/assets/monster-master/trainers/medic-trainer-v1-128.webp",
      "width": 128,
      "height": 192,
      "alpha": true,
      "usage": "asset-library",
      "assignment": "unassigned",
      "facing": "left",
      "perspective": "three-quarter-down-isometric",
      "anchor": { "x": 0.5, "y": 0.9 },
      "battlefieldScale": 1.0,
      "provenance": {
        "provider": "OpenAI ChatGPT image generation",
        "sourceArchive": "private-gameframe-asset-masters",
        "sourceSha256": "295bfb69121120f574f1a31b04640bc928d1c37dabf8ce47d9489251b65353d4",
        "runtimeSha256": "6203ed729ad291a4ebcbdac88ebc71d7a3295c16d891cfea7138067eaf3f894a",
        "rights": "generated-for-project; repository-proprietary",
        "attributionRequired": false
      }
    }'''
if '"medic-trainer-v1"' not in s:
 marker='\n  },\n  "creatures": {'
 s=s.replace(marker,',\n'+entry+marker,1)
p.write_text(s)
