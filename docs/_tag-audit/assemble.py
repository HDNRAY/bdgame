#!/usr/bin/env python3
"""把 docs/_tag-audit/ 下的前言与 6 份分类明细汇总成 docs/tag-audit.md。"""
import pathlib

d = pathlib.Path('docs/_tag-audit')
sections = [
    ('五、武器（24 + 8 起始）', 'weapons.md'),
    ('六、功法 · 上半（前 55 个）', 'passives-a.md'),
    ('七、功法 · 下半（后 55 个）', 'passives-b.md'),
    ('八、招式 · 近战/炁/空手', 'actions-a.md'),
    ('九、招式 · 玩家/支援/内部', 'actions-b.md'),
    ('十、奇物（76）', 'artifacts.md'),
]

parts = [(d / '_head.md').read_text().rstrip() + '\n']
parts.append('\n---\n\n' + (d / '_summary.md').read_text().rstrip() + '\n')
notes = (d / '_notes.md').read_text().rstrip().split('\n', 1)[-1].lstrip()
parts.append('\n' + notes + '\n')
for title, fname in sections:
    p = d / fname
    body = p.read_text().rstrip() if p.exists() else f'> ⚠️ 缺少 `docs/_tag-audit/{fname}`'
    parts.append(f'\n---\n\n## {title}\n\n{body}\n')

pathlib.Path('docs/tag-audit.md').write_text('\n'.join(parts))
print('已生成 docs/tag-audit.md，共', len('\n'.join(parts)), '字符')
