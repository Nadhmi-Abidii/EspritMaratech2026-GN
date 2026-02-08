import { spawn } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

import puppeteer from 'puppeteer-core';

const BASE_URL = process.env.AUDIT_BASE_URL ?? 'http://127.0.0.1:4201';
const API_ORIGIN = 'http://localhost:5000';
const API_PREFIX = '/api/v1';
const AUTH_STORAGE_KEY = 'omnia_auth_session';

const VIEWPORTS = [
  { name: 'mobile-xs', width: 320, height: 568 },
  { name: 'mobile-sm', width: 360, height: 640 },
  { name: 'mobile', width: 390, height: 844 },
  { name: 'mobile-lg', width: 414, height: 896 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'laptop', width: 1024, height: 768 },
  { name: 'desktop', width: 1440, height: 900 },
];

const routes = [
  '/public/info',
  '/public/reports',
  '/authentication/login',
  '/charity/home',
  '/charity/families',
  '/charity/zones/zone_tunis/families',
  '/charity/beneficiaries',
  '/charity/aids',
  '/charity/visits',
  '/charity/admin',
  '/charity/posts',
  '/charity/profile',
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function base64UrlEncodeJson(value) {
  const json = JSON.stringify(value);
  return Buffer.from(json)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function createFakeJwt(expSecondsFromNow = 60 * 60) {
  const header = base64UrlEncodeJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlEncodeJson({
    exp: Math.floor(Date.now() / 1000) + expSecondsFromNow,
    sub: 'audit-user',
  });
  return `${header}.${payload}.signature`;
}

function sanitizePathname(routePath) {
  return routePath.replace(/^\//, '').replace(/[^\w.-]+/g, '_');
}

function ensureDir(dirPath) {
  fs.mkdirSync(dirPath, { recursive: true });
}

function waitForHttpOk(url, timeoutMs = 120_000) {
  const startedAt = Date.now();

  return new Promise((resolve, reject) => {
    const tick = () => {
      const elapsed = Date.now() - startedAt;
      if (elapsed > timeoutMs) {
        reject(new Error(`Timed out waiting for ${url}`));
        return;
      }

      const request = http.get(url, (res) => {
        res.resume();
        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 500) {
          resolve();
          return;
        }
        setTimeout(tick, 350);
      });

      request.on('error', () => setTimeout(tick, 350));
      request.end();
    };

    tick();
  });
}

function findBrowserExecutable() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    'C:\\\\Program Files\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
    'C:\\\\Program Files (x86)\\\\Google\\\\Chrome\\\\Application\\\\chrome.exe',
    'C:\\\\Program Files\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
    'C:\\\\Program Files (x86)\\\\Microsoft\\\\Edge\\\\Application\\\\msedge.exe',
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
}

function success(data) {
  return JSON.stringify({ success: true, data });
}

function buildFixtures() {
  const now = new Date();
  const iso = (d) => new Date(d).toISOString();

  const zones = [
    {
      _id: 'zone_tunis',
      name: 'Tunis Centre',
      responsible: {
        _id: 'user_responsible_tunis',
        name: 'Responsable Tunis',
        email: 'responsable.tunis@example.com',
        phone: '+21600000001',
        role: 'responsible',
        isActive: true,
        assignedZones: ['zone_tunis'],
      },
      assignedFamilies: [],
    },
    {
      _id: 'zone_sfax',
      name: 'Sfax Sud',
      responsible: {
        _id: 'user_responsible_sfax',
        name: 'Responsable Sfax',
        email: 'responsable.sfax@example.com',
        phone: '+21600000002',
        role: 'responsible',
        isActive: true,
        assignedZones: ['zone_sfax'],
      },
      assignedFamilies: [],
    },
    {
      _id: 'zone_ariana',
      name: 'Ariana Nord',
      responsible: null,
      assignedFamilies: [],
    },
  ];

  const families = [
    {
      _id: 'fam_001',
      name: 'Famille Ben Salah',
      address: '12 Rue de la Republique, Tunis',
      postalCode: '1000',
      zone: 'Tunis Centre',
      zoneId: 'zone_tunis',
      phone: '+21611111111',
      email: 'ben.salah@example.com',
      numberOfPeople: 5,
      date_de_naissance: '1984-02-01T00:00:00.000Z',
      nombre_enfants: 3,
      occupation: 'Chauffeur',
      revenu_mensuel: 720,
      situation_logement: 'locataire',
      aidTypes: ['alimentaire', 'medicaments'],
      donationGoal: 8000,
      totalRaised: 4200,
      goalReached: false,
      visited: true,
      lastVisitedAt: iso(now),
      geolocation: { latitude: 36.8065, longitude: 10.1815 },
      createdAt: iso(now),
      updatedAt: iso(now),
    },
    {
      _id: 'fam_002',
      name: 'Famille El Gharbi avec un nom tres tres long pour tester le retour a la ligne sur mobile',
      address:
        "Avenue Habib Bourguiba, immeuble 17, appartement 22, pres de la station, Sfax",
      postalCode: '3000',
      zone: 'Sfax Sud',
      zoneId: 'zone_sfax',
      phone: '+21622222222',
      email: 'el.gharbi@example.com',
      numberOfPeople: 7,
      date_de_naissance: '1978-06-15T00:00:00.000Z',
      nombre_enfants: 4,
      occupation: 'Ouvrier',
      revenu_mensuel: 560,
      situation_logement: 'heberge',
      aidTypes: ['aide_specifique'],
      donationGoal: 12000,
      totalRaised: 12000,
      goalReached: true,
      visited: false,
      lastVisitedAt: null,
      geolocation: { latitude: 34.7398, longitude: 10.7600 },
      createdAt: iso(now),
      updatedAt: iso(now),
    },
    {
      _id: 'fam_003',
      name: 'Famille Trabelsi',
      address: 'Route de la Marsa, Ariana',
      postalCode: '2080',
      zone: 'Ariana Nord',
      zoneId: 'zone_ariana',
      phone: '+21633333333',
      email: 'trabelsi@example.com',
      numberOfPeople: 3,
      date_de_naissance: '1990-09-12T00:00:00.000Z',
      nombre_enfants: 1,
      occupation: 'Employe',
      revenu_mensuel: 980,
      situation_logement: 'proprietaire',
      aidTypes: ['alimentaire'],
      donationGoal: 3000,
      totalRaised: 850,
      goalReached: false,
      visited: true,
      lastVisitedAt: iso(now),
      geolocation: null,
      createdAt: iso(now),
      updatedAt: iso(now),
    },
  ];

  for (const zone of zones) {
    zone.assignedFamilies = families
      .filter((family) => family.zoneId === zone._id)
      .map((family) => ({
        _id: family._id,
        name: family.name,
        postalCode: family.postalCode,
        zone: family.zone,
        zoneId: family.zoneId,
      }));
  }

  const beneficiaries = [
    {
      _id: 'ben_001',
      firstName: 'Sami',
      lastName: 'Ben Salah',
      birthDate: '2011-03-12T00:00:00.000Z',
      gender: 'male',
      hasDisability: false,
      healthHistory: 'Suivi general',
      famille: {
        _id: 'fam_001',
        name: 'Famille Ben Salah',
        postalCode: '1000',
        zone: 'Tunis Centre',
        zoneId: 'zone_tunis',
      },
      createdAt: iso(now),
      updatedAt: iso(now),
    },
    {
      _id: 'ben_002',
      firstName: 'Meriem',
      lastName: 'El Gharbi',
      birthDate: '2016-08-05T00:00:00.000Z',
      gender: 'female',
      hasDisability: true,
      healthHistory:
        'Besoin de medicaments regulierement et suivi special. Texte long pour tester le layout.',
      famille: {
        _id: 'fam_002',
        name: families[1].name,
        postalCode: '3000',
        zone: 'Sfax Sud',
        zoneId: 'zone_sfax',
      },
      createdAt: iso(now),
      updatedAt: iso(now),
    },
  ];

  const aids = [
    {
      _id: 'aid_001',
      type: 'alimentaire',
      quantity: 12,
      aidDate: iso(now),
      observations: 'Panier alimentaire',
      famille: {
        _id: 'fam_001',
        name: 'Famille Ben Salah',
        postalCode: '1000',
        zone: 'Tunis Centre',
        zoneId: 'zone_tunis',
      },
      createdBy: {
        _id: 'user_admin',
        name: 'Admin',
        email: 'admin@example.com',
        role: 'admin',
      },
      createdAt: iso(now),
      updatedAt: iso(now),
    },
    {
      _id: 'aid_002',
      type: 'medication',
      quantity: 4,
      aidDate: iso(now),
      observations: 'Traitement mensuel',
      famille: {
        _id: 'fam_002',
        name: families[1].name,
        postalCode: '3000',
        zone: 'Sfax Sud',
        zoneId: 'zone_sfax',
      },
      createdBy: {
        _id: 'user_volunteer',
        name: 'Volunteer',
        email: 'volunteer@example.com',
        role: 'volunteer',
      },
      createdAt: iso(now),
      updatedAt: iso(now),
    },
  ];

  const visits = [
    {
      _id: 'vis_001',
      visitDate: iso(now),
      notes: 'Visite de suivi, besoins alimentaires.',
      aides: [aids[0]],
      famille: {
        _id: 'fam_001',
        name: 'Famille Ben Salah',
        postalCode: '1000',
        zone: 'Tunis Centre',
        zoneId: 'zone_tunis',
      },
      geolocation: { latitude: 36.8065, longitude: 10.1815 },
      createdAt: iso(now),
      updatedAt: iso(now),
    },
    {
      _id: 'vis_002',
      visitDate: iso(new Date(now.getTime() - 1000 * 60 * 60 * 24 * 10)),
      notes:
        "Visite avec note tres longue pour tester le retour a la ligne sur mobile. " +
        "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor.",
      aides: [aids[1]],
      famille: {
        _id: 'fam_002',
        name: families[1].name,
        postalCode: '3000',
        zone: 'Sfax Sud',
        zoneId: 'zone_sfax',
      },
      geolocation: { latitude: 34.7398, longitude: 10.7600 },
      createdAt: iso(now),
      updatedAt: iso(now),
    },
  ];

  const users = [
    {
      _id: 'user_admin',
      name: 'Admin',
      email: 'admin@example.com',
      role: 'admin',
      isActive: true,
      phone: '+21699999999',
      assignedZones: [],
      createdAt: iso(now),
      updatedAt: iso(now),
    },
    {
      _id: 'user_coordinator',
      name: 'Coordinator',
      email: 'coordinator@example.com',
      role: 'coordinator',
      isActive: true,
      phone: '+21688888888',
      assignedZones: ['zone_tunis', 'zone_sfax'],
      createdAt: iso(now),
      updatedAt: iso(now),
    },
    {
      _id: 'user_responsible',
      name: 'Responsible',
      email: 'responsible@example.com',
      role: 'responsible',
      isActive: true,
      phone: '+21677777777',
      assignedZones: ['zone_sfax'],
      createdAt: iso(now),
      updatedAt: iso(now),
    },
    {
      _id: 'user_volunteer',
      name: 'Volunteer',
      email: 'volunteer@example.com',
      role: 'volunteer',
      isActive: true,
      phone: '+21666666666',
      assignedZones: ['zone_tunis'],
      createdAt: iso(now),
      updatedAt: iso(now),
    },
  ];

  const publicInfo = {
    organization: {
      name: 'Omnia',
      fullName: 'Omnia Charity',
      tagline: 'Helping Families in Need',
      mission:
        'Support vulnerable families with transparent, documented food, medical aid, and long-term support.',
    },
    aboutUs: {
      description:
        "Omnia Charity is a community-driven organization focused on urgent aid and sustainable support.",
      goals: ['Food distribution', 'Medical support', 'Family follow-up visits'],
      history: 'Founded in 2022 to coordinate local donation efforts.',
    },
    impactOverview: {
      familiesHelped: 1234,
      beneficiariesSupported: 4567,
      visitsCompleted: 890,
      aidUnitsDistributed: 3456,
      areasServed: 12,
    },
    testimonials: [
      {
        author: 'Community Member',
        role: 'Donor',
        quote: 'Transparent updates and real impact.',
      },
    ],
    callToAction: {
      title: 'Support Our Cause',
      description: 'Donate to active campaigns and track progress in real time.',
      primaryLabel: 'View Reports',
      primaryUrl: '/public/reports',
      secondaryLabel: 'Donate Now',
      secondaryUrl: '/public/info#community',
    },
    generatedAt: iso(now),
  };

  const publicImpact = {
    summary: {
      familiesHelped: 1234,
      peopleInFamilies: 6789,
      beneficiariesSupported: 4567,
      visitsCompleted: 890,
      aidRecords: 321,
      aidUnitsDistributed: 3456,
      areasServed: 12,
    },
    aidDistribution: [
      { key: 'food', label: 'Food', totalQuantity: 2000, totalRecords: 150 },
      { key: 'medical', label: 'Medical', totalQuantity: 900, totalRecords: 90 },
      { key: 'specific', label: 'Specific Aid', totalQuantity: 556, totalRecords: 81 },
    ],
    areas: [
      { zone: 'Tunis', totalFamilies: 520 },
      { zone: 'Sfax', totalFamilies: 360 },
      { zone: 'Ariana', totalFamilies: 240 },
    ],
    aidTimeline: [
      { year: 2024, totalQuantity: 800, totalRecords: 90 },
      { year: 2025, totalQuantity: 1200, totalRecords: 140 },
    ],
    visitsTimeline: [
      { year: 2025, month: 11, label: 'Nov', totalVisits: 40 },
      { year: 2025, month: 12, label: 'Dec', totalVisits: 55 },
    ],
    generatedAt: iso(now),
  };

  const publicReports = {
    reports: [
      {
        id: 'rep_2025_impact',
        slug: 'impact-2025',
        title: 'Impact Report 2025',
        type: 'impact',
        year: 2025,
        publishedAt: iso(now),
        summary: 'Highlights of programs and field operations.',
        highlights: ['Families served by zone', 'Aid distribution', 'Visit coverage'],
        format: 'pdf',
        viewUrl: '/assets/reports/impact-2025.pdf',
        downloadUrl: '/assets/reports/impact-2025.pdf',
      },
      {
        id: 'rep_2025_financial',
        slug: 'financial-2025',
        title: 'Financial Transparency 2025',
        type: 'financial',
        year: 2025,
        publishedAt: iso(now),
        summary: 'Estimated donations vs spending breakdown.',
        highlights: ['Aid vs operations', 'Yearly trend', 'Budget note'],
        format: 'pdf',
        viewUrl: '/assets/reports/financial-2025.pdf',
        downloadUrl: '/assets/reports/financial-2025.pdf',
      },
    ],
    availableYears: [2025, 2024],
    availableTypes: ['annual', 'impact', 'financial'],
    financialSummary: {
      currency: 'USD',
      estimatedBudget: 100000,
      breakdown: [
        { key: 'aid', label: 'Aid Programs', percentage: 70, amountEstimate: 70000 },
        { key: 'ops', label: 'Operations', percentage: 20, amountEstimate: 20000 },
        { key: 'fund', label: 'Fundraising', percentage: 10, amountEstimate: 10000 },
      ],
      note: 'Figures are estimates based on documented transactions.',
    },
    financialTimeline: [
      { year: 2024, donationEstimate: 42000, spentEstimate: 38000 },
      { year: 2025, donationEstimate: 58000, spentEstimate: 52000 },
    ],
    summary: publicImpact.summary,
    familiesByZone: publicImpact.areas,
    aidByType: publicImpact.aidDistribution,
    visitsByMonth: [
      { year: 2025, month: 11, totalVisits: 40 },
      { year: 2025, month: 12, totalVisits: 55 },
    ],
    generatedAt: iso(now),
  };

  const publicPosts = [
    {
      _id: 'post_001',
      title: 'Emergency Food Basket Campaign',
      content:
        'Help families receive weekly food baskets. Donations go directly to procurement and delivery.',
      donationGoal: 15000,
      amountRaised: 8200,
      donationCount: 64,
      remainingAmount: 6800,
      progressPercent: 54.7,
      goalReached: false,
      associationType: 'family',
      familyId: 'fam_001',
      beneficiaryId: null,
      association: {
        type: 'family',
        family: {
          _id: 'fam_001',
          name: 'Famille Ben Salah',
          zone: 'Tunis Centre',
          zoneId: 'zone_tunis',
          postalCode: '1000',
          donationGoal: 8000,
          totalRaised: 4200,
          goalReached: false,
          visited: true,
        },
        beneficiary: null,
      },
      createdAt: iso(now),
      updatedAt: iso(now),
      createdBy: { _id: 'user_admin', name: 'Admin', role: 'admin' },
    },
    {
      _id: 'post_002',
      title: 'Medical Supplies Support',
      content:
        'Support chronic patients with recurring medication costs. Transparent distribution reports monthly.',
      donationGoal: 20000,
      amountRaised: 18200,
      donationCount: 98,
      remainingAmount: 1800,
      progressPercent: 91,
      goalReached: false,
      associationType: 'none',
      familyId: null,
      beneficiaryId: null,
      association: {
        type: 'none',
        family: null,
        beneficiary: null,
      },
      createdAt: iso(now),
      updatedAt: iso(now),
      createdBy: { _id: 'user_responsible', name: 'Responsible', role: 'responsible' },
    },
  ];

  return {
    zones,
    families,
    beneficiaries,
    aids,
    visits,
    users,
    publicInfo,
    publicImpact,
    publicReports,
    publicPosts,
  };
}

function buildCorsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS',
  };
}

function routeApiRequest(url, method, fixtures, currentUser) {
  const pathname = url.pathname;
  const apiPath = pathname.startsWith(API_PREFIX) ? pathname.slice(API_PREFIX.length) : pathname;

  // Auth
  if (apiPath === '/me' && method === 'GET') {
    return { status: 200, body: success(currentUser) };
  }

  if (apiPath === '/login' && method === 'POST') {
    const user = currentUser ?? fixtures.users[0];
    return {
      status: 200,
      body: success({ token: createFakeJwt(60 * 60), user }),
    };
  }

  // Charity domain
  if (apiPath === '/familles' && method === 'GET') {
    return { status: 200, body: success(fixtures.families) };
  }

  if (apiPath.startsWith('/familles/') && apiPath.endsWith('/aides') && method === 'GET') {
    const familyId = apiPath.split('/')[2];
    const filtered = fixtures.aids.filter((aid) => {
      const ref = aid.famille;
      const id = typeof ref === 'string' ? ref : ref._id;
      return id === familyId;
    });
    return { status: 200, body: success(filtered) };
  }

  if (apiPath.startsWith('/familles/') && apiPath.endsWith('/beneficiaires') && method === 'GET') {
    const familyId = apiPath.split('/')[2];
    const filtered = fixtures.beneficiaries.filter((b) => {
      const ref = b.famille;
      const id = typeof ref === 'string' ? ref : ref._id;
      return id === familyId;
    });
    return { status: 200, body: success(filtered) };
  }

  if (apiPath.startsWith('/familles/') && apiPath.endsWith('/visites') && method === 'GET') {
    const familyId = apiPath.split('/')[2];
    const filtered = fixtures.visits.filter((v) => {
      const ref = v.famille;
      const id = typeof ref === 'string' ? ref : ref._id;
      return id === familyId;
    });
    return { status: 200, body: success(filtered) };
  }

  if (apiPath === '/beneficiaires' && method === 'GET') {
    return { status: 200, body: success(fixtures.beneficiaries) };
  }

  if (apiPath === '/aides' && method === 'GET') {
    return { status: 200, body: success(fixtures.aids) };
  }

  if (apiPath === '/visites' && method === 'GET') {
    return { status: 200, body: success(fixtures.visits) };
  }

  if (apiPath === '/users' && method === 'GET') {
    return { status: 200, body: success(fixtures.users) };
  }

  if (apiPath === '/zones' && method === 'GET') {
    return { status: 200, body: success(fixtures.zones) };
  }

  // Public domain
  if (apiPath === '/public/info' && method === 'GET') {
    return { status: 200, body: success(fixtures.publicInfo) };
  }

  if (apiPath === '/public/impact' && method === 'GET') {
    return { status: 200, body: success(fixtures.publicImpact) };
  }

  if (apiPath === '/public/reports' && method === 'GET') {
    return { status: 200, body: success(fixtures.publicReports) };
  }

  if (apiPath === '/public/posts' && method === 'GET') {
    return { status: 200, body: success(fixtures.publicPosts) };
  }

  // Default: empty success to keep UI stable in audit runs.
  return { status: 200, body: success([]) };
}

async function detectHorizontalOverflow(page) {
  const metrics = await page.evaluate(() => {
    const doc = document.documentElement;
    const body = document.body;
    return {
      viewportWidth: window.innerWidth,
      docClientWidth: doc.clientWidth,
      docScrollWidth: doc.scrollWidth,
      bodyClientWidth: body ? body.clientWidth : 0,
      bodyScrollWidth: body ? body.scrollWidth : 0,
    };
  });

  const hasOverflow =
    metrics.docScrollWidth > metrics.docClientWidth + 1 ||
    metrics.bodyScrollWidth > metrics.bodyClientWidth + 1;

  if (!hasOverflow) {
    return { hasOverflow: false, metrics, offenders: [] };
  }

  const offenders = await page.evaluate(() => {
    const limit = 16;
    const out = [];
    const viewportWidth = window.innerWidth;

    const isVisible = (el) => {
      const style = window.getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
        return false;
      }
      const rect = el.getBoundingClientRect();
      return rect.width > 1 && rect.height > 1;
    };

    const els = Array.from(document.querySelectorAll('body *'));
    for (const el of els) {
      if (out.length >= limit) {
        break;
      }

      if (!isVisible(el)) {
        continue;
      }

      const rect = el.getBoundingClientRect();
      if (rect.right <= viewportWidth + 1 && rect.left >= -1) {
        continue;
      }

      const style = window.getComputedStyle(el);
      out.push({
        tag: el.tagName.toLowerCase(),
        id: el.id || null,
        className: typeof el.className === 'string' ? el.className : null,
        rect: {
          left: Number(rect.left.toFixed(2)),
          right: Number(rect.right.toFixed(2)),
          width: Number(rect.width.toFixed(2)),
        },
        position: style.position,
        overflowX: style.overflowX,
      });
    }

    return out;
  });

  return { hasOverflow: true, metrics, offenders };
}

async function run() {
  const executablePath = findBrowserExecutable();
  if (!executablePath) {
    throw new Error(
      'No Chrome/Edge executable found. Set PUPPETEER_EXECUTABLE_PATH to override.'
    );
  }

  const fixtures = buildFixtures();

  const serverUrl = new URL(BASE_URL);
  const port = Number(serverUrl.port || 4201);

  // On Windows, `npm` is typically a `.cmd` shim, so we must run via a shell.
  const npmCmd = 'npm';
  const serverProcess = spawn(
    npmCmd,
    ['run', 'start', '--', '--host', serverUrl.hostname, '--port', String(port)],
    {
      cwd: process.cwd(),
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: {
        ...process.env,
        // Avoid Angular CLI progress spam in CI-like environments.
        CI: process.env.CI ?? '1',
      },
    }
  );

  const screenshotsDir = path.join(process.cwd(), 'responsive-screenshots');
  const reportPath = path.join(process.cwd(), 'responsive-report.json');
  ensureDir(screenshotsDir);

  const report = {
    baseUrl: BASE_URL,
    viewports: VIEWPORTS,
    results: [],
    generatedAt: new Date().toISOString(),
  };

  const shutdown = async (browser) => {
    try {
      if (browser) {
        await browser.close();
      }
    } finally {
      try {
        if (process.platform === 'win32') {
          // Ensure the entire process tree is terminated (cmd.exe -> ng serve -> node).
          spawn('taskkill', ['/PID', String(serverProcess.pid), '/T', '/F'], {
            stdio: 'ignore',
          });
        } else {
          serverProcess.kill();
        }
      } catch {
        // Ignore shutdown errors.
      }
    }
  };

  let browser;
  try {
    await waitForHttpOk(BASE_URL);

    browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        '--disable-dev-shm-usage',
        '--no-sandbox',
        '--disable-gpu',
        '--disable-features=site-per-process',
      ],
    });

    const scenarios = [
      {
        name: 'public',
        user: null,
        routes: ['/public/info', '/public/reports', '/authentication/login'],
      },
      {
        name: 'charity-admin',
        user: fixtures.users.find((u) => u.role === 'admin') ?? null,
        routes: routes.filter((r) => r.startsWith('/charity/')),
      },
      {
        name: 'charity-volunteer',
        user: fixtures.users.find((u) => u.role === 'volunteer') ?? null,
        routes: ['/charity/home'],
      },
      {
        name: 'charity-coordinator',
        user: fixtures.users.find((u) => u.role === 'coordinator') ?? null,
        routes: ['/charity/home'],
      },
    ];

    for (const scenario of scenarios) {
      const context = await browser.createBrowserContext();

      for (const routePath of scenario.routes) {
        for (const viewport of VIEWPORTS) {
          const page = await context.newPage();
          await page.setViewport({
            width: viewport.width,
            height: viewport.height,
            deviceScaleFactor: 1,
          });

          const token = scenario.user ? createFakeJwt(60 * 60) : null;
          const session = scenario.user && token ? { token, user: scenario.user } : null;

          await page.evaluateOnNewDocument((storageKey, sessionValue) => {
            try {
              localStorage.removeItem(storageKey);
              if (sessionValue) {
                localStorage.setItem(storageKey, JSON.stringify(sessionValue));
              }
            } catch {
              // Ignore storage failures in audit mode.
            }
          }, AUTH_STORAGE_KEY, session);

          await page.setRequestInterception(true);
          page.on('request', async (req) => {
            try {
              const url = new URL(req.url());

              // Block 3rd party requests to keep the audit stable and fast.
              const isSameOriginAsApp =
                url.origin === serverUrl.origin || url.origin === BASE_URL;
              const isLocalAsset = url.origin === serverUrl.origin;

              if (!isSameOriginAsApp && url.origin !== API_ORIGIN) {
                await req.abort('blockedbyclient');
                return;
              }

              if (url.origin === API_ORIGIN && url.pathname.startsWith(API_PREFIX)) {
                if (req.method() === 'OPTIONS') {
                  await req.respond({
                    status: 204,
                    headers: buildCorsHeaders(),
                    body: '',
                  });
                  return;
                }

                const routed = routeApiRequest(url, req.method(), fixtures, scenario.user);
                await req.respond({
                  status: routed.status,
                  headers: {
                    'Content-Type': 'application/json; charset=utf-8',
                    ...buildCorsHeaders(),
                  },
                  body: routed.body,
                });
                return;
              }

              if (isLocalAsset) {
                await req.continue();
                return;
              }

              await req.continue();
            } catch {
              await req.continue();
            }
          });

          const url = `${BASE_URL}${routePath}`;
          await page.goto(url, { waitUntil: 'domcontentloaded' });

          // Give Angular a moment to render and charts to size.
          await sleep(1500);

          const overflow = await detectHorizontalOverflow(page);
          const ok = !overflow.hasOverflow;

          const result = {
            scenario: scenario.name,
            route: routePath,
            viewport,
            ok,
            overflow: overflow.metrics,
            offenders: overflow.offenders,
          };

          report.results.push(result);

          if (!ok) {
            const shotDir = path.join(
              screenshotsDir,
              scenario.name,
              sanitizePathname(routePath)
            );
            ensureDir(shotDir);
            const shotPath = path.join(shotDir, `${viewport.name}.png`);
            await page.screenshot({ path: shotPath, fullPage: true });
            console.error(
              `[FAIL] ${scenario.name} ${routePath} @ ${viewport.name} (${viewport.width}x${viewport.height})`
            );
          } else {
            console.log(
              `[OK]   ${scenario.name} ${routePath} @ ${viewport.name} (${viewport.width}x${viewport.height})`
            );
          }

          await page.close();
        }
      }

      await context.close();
    }

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf8');

    const failed = report.results.filter((r) => !r.ok).length;
    const total = report.results.length;

    if (failed > 0) {
      console.error(`Responsive audit: ${failed}/${total} checks failed.`);
      process.exitCode = 1;
    } else {
      console.log(`Responsive audit: all ${total} checks passed.`);
    }
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    await shutdown(browser);
  }
}

await run();
