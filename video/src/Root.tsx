import { Composition } from 'remotion';
import { DURATION, Video } from './Video';

export const Root = () => (
  <Composition id="ZapadGo" component={Video} durationInFrames={DURATION} fps={30} width={1920} height={1080} />
);
