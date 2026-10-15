// Public assets must follow Vite's base when hosted under a GitHub Pages project.
export function assetUrl(path:string,base=import.meta.env.BASE_URL){
 return `${base.replace(/\/?$/,'/')}${path.replace(/^\/+/, '')}`;
}
