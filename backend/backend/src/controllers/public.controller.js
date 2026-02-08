const Famille = require('../models/Famille');
const Beneficiaire = require('../models/Beneficiaire');
const Visite = require('../models/Visite');
const Aide = require('../models/Aide');
const PublicPost = require('../models/PublicPost');
const AppError = require('../utils/AppError');
const asyncHandler = require('../utils/asyncHandler');
const { generatePublicChatbotReply } = require('../services/public-chatbot.service');

const AID_TYPE_LABELS = {
  alimentaire: 'Food aid',
  medication: 'Medical aid',
  medicaments: 'Medical aid',
  aide_specifique: 'Specific aid',
  unknown: 'Other aid'
};

const PUBLIC_TESTIMONIALS = [
  {
    author: 'Fatma A.',
    role: 'Beneficiary family member',
    quote:
      'The regular support helped us stay stable while we rebuilt our household income.'
  },
  {
    author: 'Local Health Partner',
    role: 'Community partner',
    quote:
      'Omnia coordinates efficiently with clinics and volunteers so aid reaches people quickly.'
  },
  {
    author: 'Field Volunteer',
    role: 'Volunteer',
    quote:
      'Families are followed over time, which gives us a clearer understanding of what they need.'
  }
];

const normalizeAidType = (type) => {
  if (typeof type !== 'string' || !type.trim()) {
    return 'unknown';
  }

  return type === 'medicaments' ? 'medication' : type;
};

const toMonthLabel = (year, month) => {
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric'
  });
};

const getRequestOrigin = (req) => {
  const forwardedProto = req.headers['x-forwarded-proto'];
  const protocol =
    typeof forwardedProto === 'string' && forwardedProto.length
      ? forwardedProto.split(',')[0].trim()
      : req.protocol;

  return `${protocol}://${req.get('host')}`;
};

const escapePdfText = (value) => value.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');

const buildSimplePdf = (title, lines) => {
  const safeTitle = escapePdfText(title);
  const detailLines = lines.map((line) => escapePdfText(line && line.trim().length ? line : ' '));

  const contentCommands = ['BT', '/F1 20 Tf', '72 760 Td', `(${safeTitle}) Tj`, '/F1 11 Tf'];

  detailLines.forEach((line, index) => {
    contentCommands.push(index === 0 ? '0 -32 Td' : '0 -16 Td');
    contentCommands.push(`(${line}) Tj`);
  });

  contentCommands.push('ET');

  const content = contentCommands.join('\n');
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Count 1 /Kids [3 0 R] >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${Buffer.byteLength(content, 'utf8')} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];

  objects.forEach((objectBody, index) => {
    offsets.push(Buffer.byteLength(pdf, 'utf8'));
    pdf += `${index + 1} 0 obj\n${objectBody}\nendobj\n`;
  });

  const xrefOffset = Buffer.byteLength(pdf, 'utf8');
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += '0000000000 65535 f \n';

  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\n`;
  pdf += `startxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, 'utf8');
};

const fetchImpactMetrics = async () => {
  const [
    familySummary,
    totalBeneficiaries,
    totalVisits,
    aidSummary,
    aidByType,
    aidByYear,
    familiesByZone,
    visitsByMonth
  ] = await Promise.all([
      Famille.aggregate([
        {
          $group: {
            _id: null,
            totalFamilies: { $sum: 1 },
            totalPeople: { $sum: '$numberOfPeople' }
          }
        }
      ]),
      Beneficiaire.countDocuments(),
      Visite.countDocuments(),
      Aide.aggregate([
        {
          $group: {
            _id: null,
            totalQuantity: { $sum: '$quantity' },
            totalRecords: { $sum: 1 }
          }
        }
      ]),
      Aide.aggregate([
        {
          $group: {
            _id: '$type',
            totalQuantity: { $sum: '$quantity' },
            totalRecords: { $sum: 1 }
          }
        },
        { $sort: { totalQuantity: -1 } }
      ]),
      Aide.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$aidDate' }
            },
            totalQuantity: { $sum: '$quantity' },
            totalRecords: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': 1 } }
      ]),
      Famille.aggregate([
        {
          $group: {
            _id: {
              $ifNull: ['$zone', 'Unknown']
            },
            totalFamilies: { $sum: 1 }
          }
        },
        { $sort: { totalFamilies: -1, _id: 1 } }
      ]),
      Visite.aggregate([
        {
          $group: {
            _id: {
              year: { $year: '$visitDate' },
              month: { $month: '$visitDate' }
            },
            totalVisits: { $sum: 1 }
          }
        },
        { $sort: { '_id.year': -1, '_id.month': -1 } },
        { $limit: 12 },
        { $sort: { '_id.year': 1, '_id.month': 1 } }
      ])
    ]);

  const familyTotals = familySummary[0] || { totalFamilies: 0, totalPeople: 0 };
  const aidTotals = aidSummary[0] || { totalQuantity: 0, totalRecords: 0 };

  const aidDistribution = aidByType.map((item) => {
    const key = normalizeAidType(item._id);

    return {
      key,
      label: AID_TYPE_LABELS[key] || AID_TYPE_LABELS.unknown,
      totalQuantity: item.totalQuantity,
      totalRecords: item.totalRecords
    };
  });

  const areas = familiesByZone.map((item) => ({
    zone: item._id || 'Unknown',
    totalFamilies: item.totalFamilies
  }));

  return {
    summary: {
      familiesHelped: familyTotals.totalFamilies,
      peopleInFamilies: familyTotals.totalPeople,
      beneficiariesSupported: totalBeneficiaries,
      visitsCompleted: totalVisits,
      aidRecords: aidTotals.totalRecords,
      aidUnitsDistributed: aidTotals.totalQuantity,
      areasServed: areas.length
    },
    aidDistribution,
    areas,
    aidTimeline: aidByYear.map((item) => ({
      year: item._id.year,
      totalQuantity: item.totalQuantity,
      totalRecords: item.totalRecords
    })),
    visitsTimeline: visitsByMonth.map((item) => ({
      year: item._id.year,
      month: item._id.month,
      label: toMonthLabel(item._id.year, item._id.month),
      totalVisits: item.totalVisits
    }))
  };
};

const buildPublicInfoPayload = (impact) => ({
  organization: {
    name: 'Omnia Charity',
    fullName: 'Omnia Charity Tracking',
    tagline: 'Helping Families in Need',
    mission:
      'Provide consistent, dignified support to vulnerable families through coordinated visits, targeted aid, and transparent follow-up.'
  },
  aboutUs: {
    description:
      'Omnia Charity Tracking supports families through recurring field visits and documented aid distribution, with a focus on sustainable community support.',
    goals: [
      'Identify priority family needs through structured visits.',
      'Deliver food, medical, and specific aid with clear follow-up.',
      'Coordinate volunteers and partners to maximize local impact.',
      'Publish transparent impact and activity reports for the public.'
    ],
    history:
      'The platform was created to centralize family support operations and improve traceability of aid activities across served areas.'
  },
  impactOverview: {
    familiesHelped: impact.summary.familiesHelped,
    beneficiariesSupported: impact.summary.beneficiariesSupported,
    visitsCompleted: impact.summary.visitsCompleted,
    aidUnitsDistributed: impact.summary.aidUnitsDistributed,
    areasServed: impact.summary.areasServed
  },
  testimonials: PUBLIC_TESTIMONIALS,
  callToAction: {
    title: 'Support Our Cause',
    description:
      'Every contribution helps us expand direct aid, increase visits, and support more families.',
    primaryLabel: 'Support Our Cause',
    primaryUrl: '/public/reports',
    secondaryLabel: 'Staff Login',
    secondaryUrl: '/authentication/login'
  },
  generatedAt: new Date().toISOString()
});

const buildFinancialSummary = (impact) => {
  const estimatedBudget = Math.max(impact.summary.aidUnitsDistributed, 1) * 12;
  const directAid = Number((estimatedBudget * 0.7).toFixed(2));
  const operations = Number((estimatedBudget * 0.2).toFixed(2));
  const fundraising = Number((estimatedBudget * 0.1).toFixed(2));

  return {
    currency: 'TND',
    estimatedBudget,
    breakdown: [
      {
        key: 'direct_aid',
        label: "Programmes d'aide directe",
        percentage: 70,
        amountEstimate: directAid
      },
      {
        key: 'field_operations',
        label: 'Operations terrain',
        percentage: 20,
        amountEstimate: operations
      },
      {
        key: 'fundraising',
        label: 'Collecte de fonds et sensibilisation',
        percentage: 10,
        amountEstimate: fundraising
      }
    ],
    note:
      "Cette repartition est une estimation basee sur l'activite d'aide enregistree et une base operationnelle."
  };
};

const buildFinancialTimeline = (impact) => {
  const fallbackYear = new Date().getUTCFullYear();
  const source = impact.aidTimeline.length
    ? impact.aidTimeline
    : [
        {
          year: fallbackYear,
          totalQuantity: impact.summary.aidUnitsDistributed,
          totalRecords: impact.summary.aidRecords
        }
      ];

  return source.map((item) => {
    const baseline = Math.max(item.totalQuantity, 1) * 12;
    const donationEstimate = Number(baseline.toFixed(2));
    const spentEstimate = Number((baseline * 0.94).toFixed(2));

    return {
      year: item.year,
      donationEstimate,
      spentEstimate
    };
  });
};

const buildReportCatalog = (impact, publicBaseUrl) => {
  const now = new Date();
  const currentYear = now.getUTCFullYear();

  const toIsoUtc = (year, month, day) =>
    new Date(Date.UTC(year, month - 1, day, 9, 0, 0)).toISOString();

  const candidateYears = [currentYear, currentYear - 1, currentYear - 2].filter(
    (year) => year > 1970
  );

  const reports = [];

  candidateYears.forEach((year) => {
    reports.push({
      id: `annual-${year}`,
      slug: `annual-${year}`,
      title: `Rapport annuel ${year}`,
      type: 'annual',
      year,
      publishedAt: toIsoUtc(year + 1, 1, 15),
      summary:
        "Apercu annuel des activites: couverture, distribution de l'aide et actions communautaires.",
      highlights: [
        `${impact.summary.familiesHelped} familles accompagnees.`,
        `${impact.summary.aidRecords} operations d'aide enregistrees.`,
        `${impact.summary.visitsCompleted} visites terrain realisees.`
      ]
    });

    reports.push({
      id: `impact-h1-${year}`,
      slug: `impact-h1-${year}`,
      title: `Rapport d'impact S1 ${year}`,
      type: 'impact',
      year,
      publishedAt: toIsoUtc(year, 7, 5),
      summary:
        "Bilan semestriel d'impact axe sur la distribution de l'aide et la couverture geographique.",
      highlights: [
        `${impact.summary.aidUnitsDistributed} unites d'aide distribuees.`,
        `${impact.summary.areasServed} zones couvertes.`,
        `${impact.summary.beneficiariesSupported} beneficiaires accompagnes.`
      ]
    });

    reports.push({
      id: `impact-h2-${year}`,
      slug: `impact-h2-${year}`,
      title: `Rapport d'impact S2 ${year}`,
      type: 'impact',
      year,
      publishedAt: toIsoUtc(year + 1, 1, 5),
      summary: "Bilan de fin d'annee: suivi des familles, visites terrain et actions d'aide.",
      highlights: [
        `${impact.summary.visitsCompleted} visites terrain realisees.`,
        `${impact.summary.familiesHelped} familles suivies.`,
        `${impact.summary.aidUnitsDistributed} unites d'aide distribuees.`
      ]
    });

    reports.push({
      id: `financial-summary-${year}`,
      slug: `financial-summary-${year}`,
      title: `Resume de transparence financiere ${year}`,
      type: 'financial',
      year,
      publishedAt: toIsoUtc(year + 1, 2, 1),
      summary:
        "Repartition globale des fonds entre aide directe, operations terrain et collecte de fonds.",
      highlights: [
        'Aide directe: priorite principale.',
        'Operations terrain: visites, coordination et suivi.',
        'Collecte de fonds: soutien a la mobilisation.'
      ]
    });
  });

  const publishedReports = reports.filter(
    (report) => new Date(report.publishedAt).getTime() <= now.getTime()
  );

  publishedReports.sort(
    (first, second) => new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime()
  );

  return publishedReports.map((report) => ({
    ...report,
    format: 'pdf',
    viewUrl: `${publicBaseUrl}/reports/${report.slug}/view`,
    downloadUrl: `${publicBaseUrl}/reports/${report.slug}/download`
  }));
};

const findReportBySlug = (reports, slug) => reports.find((report) => report.slug === slug);

const clampProgress = (amountRaised, donationGoal) => {
  if (!donationGoal || donationGoal <= 0) {
    return 0;
  }

  return Math.min(100, Number(((amountRaised / donationGoal) * 100).toFixed(2)));
};

const fetchRecentCampaignPosts = async (limit = 5) => {
  const posts = await PublicPost.find({})
    .sort({ createdAt: -1 })
    .limit(limit)
    .select('title donationGoal amountRaised donationCount createdAt');

  return posts.map((post) => {
    const donationGoal = Number(post.donationGoal || 0);
    const amountRaised = Number(post.amountRaised || 0);

    return {
      title: post.title,
      donationGoal,
      amountRaised,
      donationCount: Number(post.donationCount || 0),
      progressPercent: clampProgress(amountRaised, donationGoal),
      goalReached: amountRaised >= donationGoal,
      createdAt: post.createdAt
    };
  });
};

const getPublicOverview = asyncHandler(async (_req, res) => {
  const impact = await fetchImpactMetrics();

  res.status(200).json({
    success: true,
    data: {
      organization: 'Omnia Charity Tracking',
      totals: {
        families: impact.summary.familiesHelped,
        beneficiaries: impact.summary.beneficiariesSupported,
        visits: impact.summary.visitsCompleted,
        aids: impact.summary.aidRecords
      },
      generatedAt: new Date().toISOString()
    }
  });
});

const getPublicInfo = asyncHandler(async (_req, res) => {
  const impact = await fetchImpactMetrics();

  res.status(200).json({
    success: true,
    data: buildPublicInfoPayload(impact)
  });
});

const getPublicImpact = asyncHandler(async (_req, res) => {
  const impact = await fetchImpactMetrics();

  res.status(200).json({
    success: true,
    data: {
      ...impact,
      generatedAt: new Date().toISOString()
    }
  });
});

const getPublicReports = asyncHandler(async (req, res) => {
  const impact = await fetchImpactMetrics();
  const publicBaseUrl = `${getRequestOrigin(req)}${req.baseUrl}`;
  const reportCatalog = buildReportCatalog(impact, publicBaseUrl);

  const search = String(req.query.search || '')
    .trim()
    .toLowerCase();
  const type = String(req.query.type || '')
    .trim()
    .toLowerCase();
  const year = Number(req.query.year);

  const reports = reportCatalog.filter((report) => {
    if (type && report.type !== type) {
      return false;
    }

    if (!Number.isNaN(year) && year > 0 && report.year !== year) {
      return false;
    }

    if (!search) {
      return true;
    }

    const haystack = [report.title, report.summary, report.type, ...report.highlights]
      .join(' ')
      .toLowerCase();

    return haystack.includes(search);
  });

  res.status(200).json({
    success: true,
    data: {
      reports,
      availableYears: [...new Set(reportCatalog.map((report) => report.year))].sort((a, b) => b - a),
      availableTypes: [...new Set(reportCatalog.map((report) => report.type))],
      financialSummary: buildFinancialSummary(impact),
      financialTimeline: buildFinancialTimeline(impact),
      summary: impact.summary,
      familiesByZone: impact.areas,
      aidByType: impact.aidDistribution.map((item) => ({
        type: item.key,
        label: item.label,
        totalQuantity: item.totalQuantity,
        totalRecords: item.totalRecords
      })),
      visitsByMonth: impact.visitsTimeline.map((item) => ({
        year: item.year,
        month: item.month,
        totalVisits: item.totalVisits
      })),
      generatedAt: new Date().toISOString()
    }
  });
});

const servePublicReportPdf = async (req, res, dispositionType) => {
  const impact = await fetchImpactMetrics();
  const publicBaseUrl = `${getRequestOrigin(req)}${req.baseUrl}`;
  const reports = buildReportCatalog(impact, publicBaseUrl);
  const report = findReportBySlug(reports, req.params.slug);

  if (!report) {
    throw new AppError(404, 'PUBLIC_REPORT_NOT_FOUND', 'Requested public report was not found.');
  }

  const publicationDate = new Date(report.publishedAt);
  const monthLabels = [
    'janvier',
    'fevrier',
    'mars',
    'avril',
    'mai',
    'juin',
    'juillet',
    'aout',
    'septembre',
    'octobre',
    'novembre',
    'decembre'
  ];
  const publicationDateLabel = `${publicationDate.getUTCDate()} ${
    monthLabels[publicationDate.getUTCMonth()]
  } ${publicationDate.getUTCFullYear()}`;

  const pdf = buildSimplePdf(report.title, [
    `Type: ${report.type}`,
    `Date de publication: ${publicationDateLabel}`,
    '',
    'Points cles:',
    ...report.highlights.map((highlight) => `- ${highlight}`),
    '',
    `Familles aidees: ${impact.summary.familiesHelped}`,
    `Beneficiaires accompagnes: ${impact.summary.beneficiariesSupported}`,
    `Visites effectuees: ${impact.summary.visitsCompleted}`,
    `Unites d'aide distribuees: ${impact.summary.aidUnitsDistributed}`
  ]);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `${dispositionType}; filename="${report.slug}.pdf"`);
  res.status(200).send(pdf);
};

const getPublicReportView = asyncHandler(async (req, res) => {
  await servePublicReportPdf(req, res, 'inline');
});

const getPublicReportDownload = asyncHandler(async (req, res) => {
  await servePublicReportPdf(req, res, 'attachment');
});

const askPublicChatbot = asyncHandler(async (req, res) => {
  const impact = await fetchImpactMetrics();
  const infoPayload = buildPublicInfoPayload(impact);
  const publicBaseUrl = `${getRequestOrigin(req)}${req.baseUrl}`;
  const reportCatalog = buildReportCatalog(impact, publicBaseUrl);
  const posts = await fetchRecentCampaignPosts(5);

  const chatbotResponse = await generatePublicChatbotReply({
    message: req.body.message,
    history: req.body.history,
    context: {
      organization: infoPayload.organization,
      impact: {
        ...impact.summary,
        areas: impact.areas
      },
      latestReports: reportCatalog
        .sort((first, second) => new Date(second.publishedAt).getTime() - new Date(first.publishedAt).getTime())
        .slice(0, 3),
      posts
    }
  });

  res.status(200).json({
    success: true,
    data: {
      reply: chatbotResponse.reply,
      provider: chatbotResponse.provider,
      model: chatbotResponse.model,
      generatedAt: new Date().toISOString()
    }
  });
});

module.exports = {
  getPublicOverview,
  getPublicInfo,
  getPublicImpact,
  getPublicReports,
  getPublicReportView,
  getPublicReportDownload,
  askPublicChatbot
};
