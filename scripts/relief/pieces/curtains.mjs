// The theatre curtains that frame the "day and time" section: a valance across the top and a
// drape for each side.
//
// On the page (design px, a stage 400 wide):
//   drape-l   left: 0,   top: 40,  112 x 470
//   drape-r   right: 0,  top: 40,  112 x 470
//   valance   left: 0,   top: 0,   400 x 100, laid OVER the drapes
// each as an element with the paper colour and its picture in hard light. The valance is sculpted
// in front of the tops of the two drapes and carries them in its own picture (they show below its
// swags), so it must sit on top and hide the first 60 px of each drape; the join at y = 100 is
// then exact. All three must be scaled together. See _stage.mjs, which builds exactly this.

import { MATERIAL, BLEED, canvas, heightMap } from './_field.mjs';
import { makeDrape } from './_drape.mjs';
import { makeValance } from './_valance.mjs';

export default [
  {
    name: 'valance',
    width: 400,
    height: 100,
    material: MATERIAL,
    bleed: BLEED,
    draw({ W, H }) {
      return heightMap(canvas(W, H), makeValance().height);
    },
  },
  {
    name: 'drape',
    width: 112,
    height: 470,
    material: MATERIAL,
    bleed: BLEED,
    // "l" is the left curtain as drawn; "r" is mirrored before the light falls
    variants: { l: {}, r: { flipX: true } },
    draw({ W, H }) {
      return heightMap(canvas(W, H), makeDrape().height);
    },
  },
];
