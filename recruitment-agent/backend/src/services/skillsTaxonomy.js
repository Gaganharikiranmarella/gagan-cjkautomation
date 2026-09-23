// Canonical skill -> alternate spellings/synonyms a resume might use instead.
// Matching walks this table so "JS" on a resume still matches a job asking
// for "JavaScript", "ReactJS" matches "React", etc.
const SYNONYMS = {
  javascript: ['js', 'es6', 'ecmascript'],
  typescript: ['ts'],
  python: ['py'],
  'node.js': ['node', 'nodejs'],
  'react': ['reactjs', 'react.js'],
  'vue': ['vuejs', 'vue.js'],
  angular: ['angularjs'],
  'next.js': ['nextjs', 'next'],
  express: ['expressjs', 'express.js'],
  mongodb: ['mongo'],
  postgresql: ['postgres', 'psql'],
  mysql: ['my sql'],
  aws: ['amazon web services'],
  gcp: ['google cloud', 'google cloud platform'],
  azure: ['microsoft azure'],
  docker: ['containerization'],
  kubernetes: ['k8s'],
  git: ['github', 'gitlab', 'version control'],
  'ci/cd': ['cicd', 'continuous integration', 'continuous deployment'],
  html: ['html5'],
  css: ['css3'],
  sql: ['structured query language'],
  'machine learning': ['ml'],
  'artificial intelligence': ['ai'],
  'deep learning': ['dl', 'neural networks'],
  'data analysis': ['data analytics'],
  'rest api': ['restful api', 'rest apis', 'api development'],
  graphql: [],
  java: [],
  'c++': ['cpp'],
  'c#': ['csharp', 'c sharp'],
  php: [],
  ruby: [],
  'ruby on rails': ['rails'],
  django: [],
  flask: [],
  spring: ['spring boot'],
  redux: [],
  tailwind: ['tailwindcss', 'tailwind css'],
  bootstrap: [],
  figma: [],
  'ui/ux': ['ui ux', 'user experience', 'user interface design'],
  excel: ['ms excel', 'microsoft excel'],
  'power bi': ['powerbi'],
  tableau: [],
  'project management': ['pm', 'agile', 'scrum'],
  communication: ['communication skills'],
  leadership: ['team leadership'],
  'problem solving': ['problem-solving'],
  seo: ['search engine optimization'],
  'content writing': ['copywriting', 'content creation'],
  'digital marketing': ['online marketing'],
  'social media marketing': ['smm'],
  accounting: ['bookkeeping'],
  'financial modeling': ['financial analysis'],
  sales: ['business development'],
  'customer service': ['customer support'],
  linux: ['unix'],
  'shell scripting': ['bash', 'shell script'],
  'android': ['android development'],
  ios: ['ios development', 'swift'],
  flutter: ['dart'],
  'react native': ['reactnative'],
  testing: ['qa', 'quality assurance', 'unit testing'],
  'data structures': ['dsa', 'data structures and algorithms', 'algorithms'],
};

// Generic English stopwords filtered out before mining a job description for
// implicit keywords (skillsRequired is matched separately and unaffected).
const STOPWORDS = new Set(
  (
    'a about above after again against all am an and any are as at be because been before being below ' +
    'between both but by could did do does doing down during each few for from further had has have having ' +
    'he her here hers herself him himself his how i if in into is it its itself me more most my myself nor ' +
    'not of off on once only or other ought our ours ourselves out over own same she should so some such ' +
    'than that the their theirs them themselves then there these they this those through to too under until ' +
    'up very was we were what when where which while who whom why will with you your yours yourself ' +
    'yourselves work role team using strong good excellent experience years year candidate candidates ' +
    'ability able looking join must plus preferred required requirements requirement skills skill knowledge ' +
    'including include etc will company job position responsibilities responsible working within across'
  ).split(' ')
);

// Flattened lookup: any spelling (synonym or canonical) -> canonical form
const SPELLING_TO_CANONICAL = new Map();
for (const [canonical, synonyms] of Object.entries(SYNONYMS)) {
  SPELLING_TO_CANONICAL.set(canonical, canonical);
  for (const syn of synonyms) SPELLING_TO_CANONICAL.set(syn, canonical);
}

function canonicalize(term) {
  const normalized = term.toLowerCase().trim();
  return SPELLING_TO_CANONICAL.get(normalized) || normalized;
}

module.exports = { SYNONYMS, STOPWORDS, SPELLING_TO_CANONICAL, canonicalize };
