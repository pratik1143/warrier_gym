import { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  const routes = ['', '/about', '/services', '/packages', '/team', '/app', '/contact', '/privacy-policy', '/terms'];
  return routes.map(route => ({
    url: `https://thewarriorgym.in${route}`,
    lastModified: new Date(),
    changeFrequency: 'weekly',
    priority: route === '' ? 1.0 : route === '/privacy-policy' || route === '/terms' ? 0.5 : 0.8,
  }));
}
