import {describe,it,expect} from 'vitest';
import {assetUrl} from './assets';
import {readProgress,newProgress} from './storage';
import {readBirth,newBirthProgress} from './birth';
import {MODULES,resolveModule} from './modules';

describe('deployment and restricted storage',()=>{
 it('resolves all models under both the root site and a GitHub Pages project',()=>{
  for(const name of ['pelvis.glb','fetus.glb','birth-fetus.glb','fhr-room.glb']){
   expect(new URL(assetUrl(`models/${name}`,'/'),'https://example.test/?module=fetal-position').pathname).toBe(`/models/${name}`);
   expect(new URL(assetUrl(`models/${name}`,'/obstetric-learning/'),'https://example.test/obstetric-learning/?module=fetal-position').pathname).toBe(`/obstetric-learning/models/${name}`);
  }
 });
 it('preserves model cache versions in a subdirectory deployment',()=>{
  expect(assetUrl('models/fhr-room.glb?v=1.0','/obstetric-learning/')).toBe('/obstetric-learning/models/fhr-room.glb?v=1.0');
 });
 it('keeps the three published deep links and returns withdrawn or unknown links to the index',()=>{
  expect(MODULES.map(module=>module.id)).toEqual(['fetal-position','birth-mechanism','fetal-heart-rate']);
  for(const module of MODULES)expect(resolveModule(module.id)).toBe(module.id);
  expect(resolveModule(null)).toBe('fetal-position');
  expect(resolveModule('all')).toBe('all');
  expect(resolveModule('palpation')).toBe('all');
  expect(resolveModule('unknown')).toBe('all');
 });
 it('opens the position and birth modules when the browser denies storage access',()=>{
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw new DOMException('Blocked','SecurityError');}});
  try{expect(readProgress()).toEqual(newProgress());expect(readBirth()).toEqual(newBirthProgress());}
  finally{if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else Reflect.deleteProperty(globalThis,'localStorage');}
 });
});
