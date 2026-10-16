"""Check edited SVG parts and pose references: python3 check_artwork.py."""
import json
from pathlib import Path
import sys
import xml.etree.ElementTree as ET

root = Path(__file__).resolve().parent / 'artwork'
errors = []
parts = 0
frames = 0
try:
    catalog = json.loads((root / 'manifest.json').read_text())
    assert catalog['version'] == 1, 'Unsupported manifest version'
    assert catalog['size'] > 0, 'Artboard size must be positive'
    for cat_id, cat in catalog['cats'].items():
        for name, component in cat['components'].items():
            parts += 1
            file = root / component['file']
            try:
                svg = ET.parse(file).getroot()
                assert svg.tag == '{http://www.w3.org/2000/svg}svg', 'Root must be an SVG with its namespace'
                box = [float(value) for value in svg.attrib['viewBox'].replace(',', ' ').split()]
                assert len(box) == 4 and box[2] > 0 and box[3] > 0, 'Invalid viewBox'
            except (OSError, ET.ParseError, AssertionError, KeyError, ValueError) as error:
                errors.append(f'{component["file"]}: {error}')
        assert set(cat['states']) == {'idle', 'walk', 'groom', 'sleep'}, f'{cat_id}: engine requires idle/walk/groom/sleep'
        for state_name, state in cat['states'].items():
            assert state['duration'] > 0, f'{cat_id}/{state_name}: duration must be positive'
            assert set(state['directions']) == set(catalog['directions']), f'{cat_id}/{state_name}: missing directions'
            for direction, poses in state['directions'].items():
                assert poses, f'{cat_id}/{state_name}/{direction}: empty animation'
                for index, pose in enumerate(poses):
                    frames += 1
                    assert pose['layers'], f'{cat_id}/{state_name}/{direction}/{index}: empty pose'
                    for layer in pose['layers']:
                        if layer['component'] not in cat['components']:
                            errors.append(f'{cat_id}/{state_name}/{direction}/{index}: unknown part {layer["component"]}')
except (OSError, ValueError, KeyError, TypeError, AssertionError) as error:
    errors.append(f'manifest.json: {error}')

if errors:
    print('\n'.join(errors), file=sys.stderr)
    sys.exit(1)
print(f'OK: {parts} SVG parts and {frames} pose frames; all references resolve.')
