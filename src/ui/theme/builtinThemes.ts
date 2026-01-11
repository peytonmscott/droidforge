import type { ThemeFile, ThemeMode } from './themeSchema';

import aura from './themes/aura.json';
import ayu from './themes/ayu.json';
import catppuccin from './themes/catppuccin.json';
import catppuccinFrappe from './themes/catppuccin-frappe.json';
import catppuccinMacchiato from './themes/catppuccin-macchiato.json';
import cobalt2 from './themes/cobalt2.json';
import cursor from './themes/cursor.json';
import dracula from './themes/dracula.json';
import everforest from './themes/everforest.json';
import flexoki from './themes/flexoki.json';
import github from './themes/github.json';
import gruvbox from './themes/gruvbox.json';
import kanagawa from './themes/kanagawa.json';
import lucentOrng from './themes/lucent-orng.json';
import material from './themes/material.json';
import matrix from './themes/matrix.json';
import mercury from './themes/mercury.json';
import monokai from './themes/monokai.json';
import nightowl from './themes/nightowl.json';
import nord from './themes/nord.json';
import oneDark from './themes/one-dark.json';
import opencode from './themes/opencode.json';
import orng from './themes/orng.json';
import osakaJade from './themes/osaka-jade.json';
import palenight from './themes/palenight.json';
import rosepine from './themes/rosepine.json';
import solarized from './themes/solarized.json';
import synthwave84 from './themes/synthwave84.json';
import tokyonight from './themes/tokyonight.json';
import vercel from './themes/vercel.json';
import vesper from './themes/vesper.json';
import zenburn from './themes/zenburn.json';

export interface ThemeRegistration {
    id: string;
    displayName: string;
    source: 'builtin';
    file: ThemeFile;
    mode?: ThemeMode;
}

export const BUILTIN_THEMES: ThemeRegistration[] = [
    { id: 'opencode', displayName: 'OpenCode', source: 'builtin', file: opencode },

    { id: 'aura', displayName: 'Aura', source: 'builtin', file: aura },
    { id: 'tokyonight', displayName: 'Tokyo Night', source: 'builtin', file: tokyonight },
    { id: 'everforest', displayName: 'Everforest', source: 'builtin', file: everforest },
    { id: 'ayu', displayName: 'Ayu', source: 'builtin', file: ayu, mode: 'dark' },

    // Catppuccin variants
    { id: 'catppuccin-mocha', displayName: 'Catppuccin Mocha', source: 'builtin', file: catppuccin, mode: 'dark' },
    { id: 'catppuccin-latte', displayName: 'Catppuccin Latte', source: 'builtin', file: catppuccin, mode: 'light' },
    { id: 'catppuccin-frappe', displayName: 'Catppuccin Frappe', source: 'builtin', file: catppuccinFrappe, mode: 'dark' },
    { id: 'catppuccin-macchiato', displayName: 'Catppuccin Macchiato', source: 'builtin', file: catppuccinMacchiato, mode: 'dark' },

    { id: 'cobalt2', displayName: 'Cobalt2', source: 'builtin', file: cobalt2 },
    { id: 'cursor', displayName: 'Cursor', source: 'builtin', file: cursor },
    { id: 'dracula', displayName: 'Dracula', source: 'builtin', file: dracula },
    { id: 'flexoki', displayName: 'Flexoki', source: 'builtin', file: flexoki },
    { id: 'github', displayName: 'GitHub', source: 'builtin', file: github },
    { id: 'gruvbox', displayName: 'Gruvbox', source: 'builtin', file: gruvbox },
    { id: 'kanagawa', displayName: 'Kanagawa', source: 'builtin', file: kanagawa },
    { id: 'lucent-orng', displayName: 'Lucent Orng', source: 'builtin', file: lucentOrng },
    { id: 'material', displayName: 'Material', source: 'builtin', file: material },
    { id: 'matrix', displayName: 'Matrix', source: 'builtin', file: matrix },
    { id: 'mercury', displayName: 'Mercury', source: 'builtin', file: mercury },
    { id: 'monokai', displayName: 'Monokai', source: 'builtin', file: monokai },
    { id: 'nightowl', displayName: 'Night Owl', source: 'builtin', file: nightowl },
    { id: 'nord', displayName: 'Nord', source: 'builtin', file: nord },
    { id: 'one-dark', displayName: 'One Dark', source: 'builtin', file: oneDark },
    { id: 'orng', displayName: 'Orng', source: 'builtin', file: orng },
    { id: 'osaka-jade', displayName: 'Osaka Jade', source: 'builtin', file: osakaJade },
    { id: 'palenight', displayName: 'Palenight', source: 'builtin', file: palenight },
    { id: 'rosepine', displayName: 'Rosé Pine', source: 'builtin', file: rosepine },
    { id: 'solarized', displayName: 'Solarized', source: 'builtin', file: solarized },
    { id: 'synthwave84', displayName: 'Synthwave 84', source: 'builtin', file: synthwave84 },
    { id: 'vercel', displayName: 'Vercel', source: 'builtin', file: vercel },
    { id: 'vesper', displayName: 'Vesper', source: 'builtin', file: vesper },
    { id: 'zenburn', displayName: 'Zenburn', source: 'builtin', file: zenburn },
];
