import json
from pathlib import Path

path = Path('public/assets/monster-master/manifest.json')
data = json.loads(path.read_text())
source = 'approved-caller-trainer-isometric-master-v1'
if source not in data['sources']:
    data['sources'].append(source)
data['trainerAssets']['caller-trainer-v1'] = {
    'label': 'Caller',
    'archetype': 'caller',
    'path': '/assets/monster-master/trainers/caller-trainer-v1-128.webp',
    'width': 128,
    'height': 192,
    'alpha': True,
    'usage': 'asset-library',
    'assignment': 'unassigned',
    'facing': 'left',
    'perspective': 'three-quarter-down-isometric',
    'anchor': {'x': 0.5, 'y': 0.9},
    'battlefieldScale': 1.0,
    'provenance': {
        'provider': 'OpenAI ChatGPT image generation',
        'sourceArchive': 'private-gameframe-asset-masters',
        'sourceSha256': '36ae023f67da762947755514b797bce82e51e9e6268bdec83ce621b6bb80490d',
        'runtimeSha256': 'd5e1d9291ac28f6f63e56cd5304ed010ca85b3bc23dae9562d4826051da4dc34',
        'rights': 'generated-for-project; repository-proprietary',
        'attributionRequired': False,
    },
}
path.write_text(json.dumps(data, indent=2) + '\n')
