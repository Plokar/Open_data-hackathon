import path from 'node:path';
import { Config } from '@remotion/cli/config';

const local = (m: string) => path.join(process.cwd(), 'node_modules', m);

Config.setEntryPoint('src/index.ts');
Config.setVideoImageFormat('jpeg');
// Landscape, MascotArt a generátor tvorů bereme přímo z aplikace, ať video vypadá jako appka.
// React smí být v bundlu jen jednou, proto alias na lokální kopii.
Config.overrideWebpackConfig((c) => ({
  ...c,
  resolve: {
    ...c.resolve,
    alias: {
      ...(c.resolve?.alias as Record<string, string>),
      '@': path.join(process.cwd(), '../frontend/src'),
      'lucide-react': path.join(process.cwd(), '../frontend/node_modules/lucide-react'), // ikony stejné jako v aplikaci
      react: local('react'),
      'react-dom': local('react-dom'),
    },
  },
}));
