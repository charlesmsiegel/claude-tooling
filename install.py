#!/usr/bin/env python3
"""
Install Claude Code configuration (agents, commands, hooks, skills) to a project.

Usage:
    python install.py --list                          # List all available items
    python install.py --list hooks                    # List available hooks
    python install.py --list skills                   # List available skills
    python install.py agents file-reader maker-agent  # Install specific agents
    python install.py hooks --profile python          # Install hook profile
    python install.py skills django-caching           # Install specific skill
    python install.py all --target ~/myproject        # Install everything

Items are copied to <target>/.claude/<type>/ and settings JSON is printed.
"""

import argparse
import json
import re
import shutil
import sys
from pathlib import Path

TOOLING_ROOT = Path(__file__).parent


def extract_settings_json(file_path: Path) -> dict | None:
    """Extract settings JSON from comment block at top of file."""
    content = file_path.read_text()

    # Look for JSON in comments (supports # and <!-- --> style)
    patterns = [
        r'#\s*Settings:\s*(\{.*?\})\s*(?:\n[^#]|\Z)',  # Python/shell style
        r'<!--\s*Settings:\s*(\{.*?\})\s*-->',          # HTML/MD style
    ]

    for pattern in patterns:
        match = re.search(pattern, content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass

    return None


def parse_frontmatter(file_path: Path) -> dict:
    """Parse YAML-like frontmatter from markdown files."""
    content = file_path.read_text()
    if not content.startswith('---'):
        return {}

    end = content.find('---', 3)
    if end == -1:
        return {}

    frontmatter = {}
    for line in content[3:end].strip().split('\n'):
        if ':' in line:
            key, value = line.split(':', 1)
            frontmatter[key.strip()] = value.strip()

    return frontmatter


class HookManager:
    """Manage hook installation."""

    def __init__(self):
        self.hooks_dir = TOOLING_ROOT / 'hooks'
        self.config = self._load_config()

    def _load_config(self) -> dict:
        config_path = self.hooks_dir / 'hooks.json'
        if config_path.exists():
            return json.loads(config_path.read_text())
        return {'hooks': [], 'profiles': {}}

    def list_items(self):
        print("\n=== Available Hooks ===\n")
        for hook in self.config['hooks']:
            tags = ', '.join(hook['tags'])
            requires = ', '.join(hook['requires']) if hook['requires'] else 'none'
            print(f"  {hook['id']:<20} {hook['name']}")
            print(f"  {'':20} {hook['description']}")
            print(f"  {'':20} Tags: {tags} | Requires: {requires}")
            print()

        print("\n=== Hook Profiles ===\n")
        for name, profile in self.config['profiles'].items():
            hooks_list = ', '.join(profile['hooks'])
            print(f"  {name:<20} {profile['description']}")
            print(f"  {'':20} Hooks: {hooks_list}")
            print()

    def get_hooks(self, ids: list[str] = None, profile: str = None) -> list[dict]:
        hooks_by_id = {h['id']: h for h in self.config['hooks']}

        if profile:
            if profile not in self.config['profiles']:
                print(f"Error: Unknown profile '{profile}'")
                sys.exit(1)
            ids = self.config['profiles'][profile]['hooks']
        elif ids is None:
            ids = [h['id'] for h in self.config['hooks']]

        return [hooks_by_id[i] for i in ids if i in hooks_by_id]

    def install(self, target: Path, ids: list[str] = None, profile: str = None):
        hooks = self.get_hooks(ids, profile)
        if not hooks:
            print("No hooks selected.")
            return {}

        target_dir = target / '.claude' / 'hooks'
        target_dir.mkdir(parents=True, exist_ok=True)

        print(f"\nInstalling {len(hooks)} hook(s) to {target_dir}")

        for hook in hooks:
            src = self.hooks_dir / hook['file']
            if src.exists():
                dst = target_dir / hook['file']
                shutil.copy2(src, dst)
                if hook['file'].endswith('.sh'):
                    dst.chmod(0o755)
                print(f"  Copied: {hook['file']}")

        return self._generate_settings(hooks)

    def _generate_settings(self, hooks: list[dict]) -> dict:
        pre_tool_use = {}
        post_tool_use = {}

        for hook in hooks:
            command = f"{'python3' if hook['file'].endswith('.py') else 'bash'} .claude/hooks/{hook['file']}"
            entry = {
                'type': 'command',
                'command': command,
                'statusMessage': hook.get('statusMessage', hook['name']),
            }

            target = pre_tool_use if hook['type'] == 'PreToolUse' else post_tool_use
            matcher = hook['matcher']
            if matcher not in target:
                target[matcher] = []
            target[matcher].append(entry)

        result = {}
        if pre_tool_use:
            result['PreToolUse'] = [
                {'matcher': m, 'hooks': h} for m, h in pre_tool_use.items()
            ]
        if post_tool_use:
            result['PostToolUse'] = [
                {'matcher': m, 'hooks': h} for m, h in post_tool_use.items()
            ]

        return {'hooks': result} if result else {}


class AgentManager:
    """Manage agent installation."""

    def __init__(self):
        self.agents_dir = TOOLING_ROOT / 'agents'

    def list_items(self):
        print("\n=== Available Agents ===\n")
        for agent_file in sorted(self.agents_dir.glob('*.md')):
            meta = parse_frontmatter(agent_file)
            name = meta.get('name', agent_file.stem)
            desc = meta.get('description', 'No description')[:80]
            model = meta.get('model', 'default')
            print(f"  {name:<20} [{model}] {desc}...")
            print()

    def get_agents(self, ids: list[str] = None) -> list[Path]:
        if ids is None:
            return list(self.agents_dir.glob('*.md'))
        return [self.agents_dir / f"{i}.md" for i in ids if (self.agents_dir / f"{i}.md").exists()]

    def install(self, target: Path, ids: list[str] = None):
        agents = self.get_agents(ids)
        if not agents:
            print("No agents selected.")
            return {}

        target_dir = target / '.claude' / 'agents'
        target_dir.mkdir(parents=True, exist_ok=True)

        print(f"\nInstalling {len(agents)} agent(s) to {target_dir}")

        for agent in agents:
            if agent.exists():
                shutil.copy2(agent, target_dir / agent.name)
                print(f"  Copied: {agent.name}")

        return {}  # Agents don't need settings.json entries


class CommandManager:
    """Manage command installation."""

    def __init__(self):
        self.commands_dir = TOOLING_ROOT / 'commands'

    def list_items(self):
        print("\n=== Available Commands ===\n")
        for cmd_file in sorted(self.commands_dir.glob('*.md')):
            content = cmd_file.read_text()[:200]
            print(f"  {cmd_file.stem:<20} {content[:60]}...")
            print()

    def get_commands(self, ids: list[str] = None) -> list[Path]:
        if ids is None:
            return list(self.commands_dir.glob('*.md'))
        return [self.commands_dir / f"{i}.md" for i in ids if (self.commands_dir / f"{i}.md").exists()]

    def install(self, target: Path, ids: list[str] = None):
        commands = self.get_commands(ids)
        if not commands:
            print("No commands selected.")
            return {}

        target_dir = target / '.claude' / 'commands'
        target_dir.mkdir(parents=True, exist_ok=True)

        print(f"\nInstalling {len(commands)} command(s) to {target_dir}")

        for cmd in commands:
            if cmd.exists():
                shutil.copy2(cmd, target_dir / cmd.name)
                print(f"  Copied: {cmd.name}")

        # Commands need permissions
        permissions = []
        for cmd in commands:
            permissions.append(f"Skill({cmd.stem})")

        return {'permissions': {'allow': permissions}} if permissions else {}


class SkillManager:
    """Manage skill installation."""

    def __init__(self):
        self.skills_dir = TOOLING_ROOT / 'skills'

    def list_items(self):
        print("\n=== Available Skills ===\n")
        if not self.skills_dir.exists():
            print("  (none)")
            return
        for skill_dir in sorted(self.skills_dir.iterdir()):
            if skill_dir.is_dir():
                skill_file = skill_dir / 'SKILL.md'
                if skill_file.exists():
                    meta = parse_frontmatter(skill_file)
                    name = meta.get('name', skill_dir.name)
                    desc = meta.get('description', 'No description')[:80]
                    print(f"  {skill_dir.name:<25} {desc}...")
                    print()

    def get_skills(self, ids: list[str] = None) -> list[Path]:
        if not self.skills_dir.exists():
            return []
        if ids is None:
            return [d for d in self.skills_dir.iterdir() if d.is_dir() and (d / 'SKILL.md').exists()]
        return [self.skills_dir / i for i in ids if (self.skills_dir / i).is_dir()]

    def install(self, target: Path, ids: list[str] = None):
        skills = self.get_skills(ids)
        if not skills:
            print("No skills selected.")
            return {}

        target_dir = target / '.claude' / 'skills'
        target_dir.mkdir(parents=True, exist_ok=True)

        print(f"\nInstalling {len(skills)} skill(s) to {target_dir}")

        for skill in skills:
            if skill.exists():
                dst = target_dir / skill.name
                if dst.exists():
                    shutil.rmtree(dst)
                shutil.copytree(skill, dst)
                print(f"  Copied: {skill.name}/")

        return {}  # Skills don't need settings.json entries


def dedupe_hooks(hook_list: list[dict]) -> list[dict]:
    """Remove duplicate hooks based on command."""
    seen = set()
    result = []
    for hook in hook_list:
        key = hook.get('command', '')
        if key not in seen:
            seen.add(key)
            result.append(hook)
    return result


def merge_settings(*settings_dicts):
    """Merge multiple settings dictionaries, deduplicating entries."""
    result = {}

    for settings in settings_dicts:
        for key, value in settings.items():
            if key == 'hooks':
                if 'hooks' not in result:
                    result['hooks'] = {}
                for hook_type, hook_list in value.items():
                    if hook_type not in result['hooks']:
                        result['hooks'][hook_type] = []
                    result['hooks'][hook_type].extend(hook_list)
            elif key == 'permissions':
                if 'permissions' not in result:
                    result['permissions'] = {'allow': [], 'deny': [], 'ask': []}
                for perm_type, perm_list in value.items():
                    result['permissions'][perm_type].extend(perm_list)
            else:
                result[key] = value

    # Deduplicate hooks - merge entries with same matcher, then dedupe commands
    if 'hooks' in result:
        for hook_type in result['hooks']:
            # Group by matcher
            by_matcher = {}
            for entry in result['hooks'][hook_type]:
                matcher = entry.get('matcher', '')
                if matcher not in by_matcher:
                    by_matcher[matcher] = []
                by_matcher[matcher].extend(entry.get('hooks', []))
            # Rebuild with deduped hooks
            result['hooks'][hook_type] = [
                {'matcher': matcher, 'hooks': dedupe_hooks(hooks)}
                for matcher, hooks in by_matcher.items()
            ]

    # Deduplicate permissions
    if 'permissions' in result:
        for perm_type in result['permissions']:
            result['permissions'][perm_type] = list(dict.fromkeys(result['permissions'][perm_type]))

    return result


def update_settings_file(target: Path, new_settings: dict):
    """Update or create settings.local.json in target/.claude/"""
    settings_dir = target / '.claude'
    settings_dir.mkdir(parents=True, exist_ok=True)
    settings_file = settings_dir / 'settings.local.json'

    # Load existing settings if present
    if settings_file.exists():
        existing = json.loads(settings_file.read_text())
    else:
        existing = {}

    # Merge new settings into existing
    merged = merge_settings(existing, new_settings)

    # Write back
    settings_file.write_text(json.dumps(merged, indent=2) + '\n')
    return settings_file


def main():
    parser = argparse.ArgumentParser(
        description='Install Claude Code configuration to a project',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        'type',
        nargs='?',
        choices=['agents', 'commands', 'hooks', 'skills', 'all'],
        help='Type of items to install',
    )
    parser.add_argument(
        'items',
        nargs='*',
        help='Specific items to install (omit for all)',
    )
    parser.add_argument(
        '--list', '-l',
        nargs='?',
        const='all',
        help='List available items (optionally specify type)',
    )
    parser.add_argument(
        '--profile', '-p',
        help='Hook profile to install (general, python)',
    )
    parser.add_argument(
        '--target', '-t',
        type=Path,
        default=Path.cwd(),
        help='Target project directory (default: current directory)',
    )

    args = parser.parse_args()

    managers = {
        'agents': AgentManager(),
        'commands': CommandManager(),
        'hooks': HookManager(),
        'skills': SkillManager(),
    }

    # List mode
    if args.list:
        if args.list == 'all':
            for manager in managers.values():
                manager.list_items()
        elif args.list in managers:
            managers[args.list].list_items()
        else:
            print(f"Unknown type: {args.list}")
            sys.exit(1)
        return

    if not args.type:
        parser.print_help()
        return

    # Install mode
    target = args.target.resolve()
    all_settings = []

    if args.type == 'all':
        for name, manager in managers.items():
            if name == 'hooks' and args.profile:
                settings = manager.install(target, profile=args.profile)
            else:
                settings = manager.install(target)
            all_settings.append(settings)
    else:
        manager = managers[args.type]
        items = args.items if args.items else None

        if args.type == 'hooks' and args.profile:
            settings = manager.install(target, profile=args.profile)
        else:
            settings = manager.install(target, items)
        all_settings.append(settings)

    # Update settings.local.json
    merged = merge_settings(*all_settings)
    if merged:
        settings_file = update_settings_file(target, merged)
        print(f"\nUpdated: {settings_file}")

    print("\nDone!")


if __name__ == '__main__':
    main()
