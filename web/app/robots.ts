import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/', '/profil/', '/einstellungen/', '/benachrichtigungen/'],
      },
    ],
    sitemap: 'https://thepin.app/sitemap.xml',
  };
}
