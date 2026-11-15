// Schema.org page/entity types the dashboard offers, with their fields and Google's rules.
// Field keys are schema.org property paths ("offers.price"); the builder expands them into nested nodes.
// Status as of Nov 2026: FAQ rich results stopped 7 May 2026, HowTo earlier; both stay valid schema.org
// that other engines and AI assistants read, so they are kept and labelled.

export type FieldType = 'text' | 'textarea' | 'url' | 'image' | 'date' | 'datetime' | 'number' | 'boolean' | 'select' | 'list' | 'duration';

export type Field = {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  help?: string;
  placeholder?: string;
  /** Google requires it for the rich result. */
  required?: boolean;
  /** Google recommends it. */
  recommended?: boolean;
  /** Filled automatically from the page when left empty. */
  auto?: string;
};

export type RichResult = 'yes' | 'no' | 'retired';

export type SchemaType = {
  type: string;
  label: string;
  group: 'Page' | 'Content' | 'Business' | 'Commerce' | 'Media' | 'Other';
  /** "page": sets the WebPage @type. "entity": a separate main entity on a WebPage. */
  kind: 'page' | 'entity';
  /** WebPage subtype used when kind is "entity". */
  pageType?: string;
  rich: RichResult;
  note?: string;
  fields: Field[];
};

/** Nested object types for dotted paths. */
export const NESTED: Record<string, string> = {
  offers: 'Offer',
  brand: 'Brand',
  aggregateRating: 'AggregateRating',
  location: 'Place',
  'location.address': 'PostalAddress',
  organizer: 'Organization',
  performer: 'Person',
  baseSalary: 'MonetaryAmount',
  'baseSalary.value': 'QuantitativeValue',
  jobLocation: 'Place',
  'jobLocation.address': 'PostalAddress',
  applicantLocationRequirements: 'Country',
  nutrition: 'NutritionInformation',
  hasCourseInstance: 'CourseInstance',
  mainEntity: 'Person',
  address: 'PostalAddress',
  geo: 'GeoCoordinates',
  provider: 'Organization',
  recipient: 'Organization',
};

/** Enum-valued properties written as schema.org URLs. */
export const ENUMS: Record<string, string> = {
  availability: 'https://schema.org/',
  itemCondition: 'https://schema.org/',
  eventStatus: 'https://schema.org/',
  eventAttendanceMode: 'https://schema.org/',
};

const name: Field = { key: 'name', label: 'Name', type: 'text', required: true, auto: 'Page title' };
const description: Field = { key: 'description', label: 'Description', type: 'textarea', recommended: true, auto: 'Page description' };
const image: Field = { key: 'image', label: 'Image', type: 'image', recommended: true, auto: 'Share image' };
const price = (required = false): Field[] => [
  { key: 'offers.price', label: 'Price', type: 'number', required, placeholder: '0 for free' },
  { key: 'offers.priceCurrency', label: 'Currency', type: 'text', required, placeholder: 'INR, USD, EUR…' },
];
const address = (required = false): Field[] => [
  { key: 'address.streetAddress', label: 'Street', type: 'text', required },
  { key: 'address.addressLocality', label: 'City', type: 'text', required },
  { key: 'address.addressRegion', label: 'Region / state', type: 'text' },
  { key: 'address.postalCode', label: 'Postal code', type: 'text' },
  { key: 'address.addressCountry', label: 'Country (ISO code)', type: 'text', placeholder: 'IN' },
];
const rating: Field[] = [
  { key: 'aggregateRating.ratingValue', label: 'Rating', type: 'number', placeholder: '4.8' },
  { key: 'aggregateRating.reviewCount', label: 'Review count', type: 'number' },
];

const page = (type: string, label: string, note?: string, rich: RichResult = 'no'): SchemaType => ({ type, label, group: 'Page', kind: 'page', rich, note, fields: [] });

export const SCHEMA_TYPES: SchemaType[] = [
  page('WebPage', 'Web page'),
  page('AboutPage', 'About page', 'Also gets the full Organization node.'),
  page('ContactPage', 'Contact page', 'Also gets the full Organization node with contact details.'),
  page('CollectionPage', 'Collection / listing'),
  page('ItemPage', 'Item page'),
  page('SearchResultsPage', 'Search results'),
  { ...page('FAQPage', 'FAQ page', 'Google stopped FAQ rich results in May 2026. Still read by Bing and AI assistants. Add questions under Answers.', 'retired') },
  {
    type: 'ProfilePage',
    label: 'Profile page',
    group: 'Page',
    kind: 'page',
    rich: 'yes',
    note: 'A page about one person (team member, author).',
    fields: [
      { key: 'mainEntity.name', label: 'Person name', type: 'text', required: true },
      { key: 'mainEntity.jobTitle', label: 'Job title', type: 'text' },
      { key: 'mainEntity.description', label: 'Bio', type: 'textarea' },
      { key: 'mainEntity.image', label: 'Photo', type: 'image' },
      { key: 'mainEntity.sameAs', label: 'Profiles (LinkedIn, X…)', type: 'list' },
      { key: 'mainEntity.knowsAbout', label: 'Expertise', type: 'list' },
    ],
  },
  ...(['Article', 'BlogPosting', 'NewsArticle'] as const).map(
    (type): SchemaType => ({
      type,
      label: type === 'Article' ? 'Article' : type === 'BlogPosting' ? 'Blog post' : 'News article',
      group: 'Content',
      kind: 'entity',
      rich: 'yes',
      note: 'Author and dates come from Answers → Author / Published.',
      fields: [
        { key: 'headline', label: 'Headline', type: 'text', recommended: true, auto: 'Page title', help: 'Up to 110 characters.' },
        description,
        image,
        { key: 'articleSection', label: 'Section', type: 'text' },
        { key: 'keywords', label: 'Keywords', type: 'list' },
        { key: 'wordCount', label: 'Word count', type: 'number', auto: 'Counted from the page' },
      ],
    }),
  ),
  {
    type: 'Product',
    label: 'Product',
    group: 'Commerce',
    kind: 'entity',
    pageType: 'ItemPage',
    rich: 'yes',
    note: 'Needs a price, a rating or a review for the product snippet; price + currency + availability for merchant listings.',
    fields: [
      name,
      description,
      image,
      { key: 'brand.name', label: 'Brand', type: 'text', recommended: true },
      { key: 'sku', label: 'SKU', type: 'text' },
      { key: 'gtin', label: 'GTIN / EAN / UPC', type: 'text' },
      { key: 'mpn', label: 'MPN', type: 'text' },
      ...price(true),
      { key: 'offers.availability', label: 'Availability', type: 'select', options: ['InStock', 'OutOfStock', 'PreOrder', 'BackOrder', 'LimitedAvailability', 'OnlineOnly', 'InStoreOnly', 'SoldOut', 'Discontinued'], recommended: true },
      { key: 'offers.itemCondition', label: 'Condition', type: 'select', options: ['NewCondition', 'UsedCondition', 'RefurbishedCondition', 'DamagedCondition'] },
      { key: 'offers.priceValidUntil', label: 'Price valid until', type: 'date' },
      ...rating,
    ],
  },
  {
    type: 'Service',
    label: 'Service',
    group: 'Business',
    kind: 'entity',
    rich: 'no',
    note: 'No rich result, but helps engines and AI understand what you offer.',
    fields: [
      name,
      description,
      { key: 'serviceType', label: 'Service type', type: 'text' },
      { key: 'areaServed', label: 'Area served', type: 'list' },
      ...price(),
      image,
    ],
  },
  {
    type: 'LocalBusiness',
    label: 'Local business (location page)',
    group: 'Business',
    kind: 'entity',
    rich: 'yes',
    note: 'For a branch/location page. The site-wide business goes in Site settings → Organization.',
    fields: [
      name,
      { key: 'address.streetAddress', label: 'Street', type: 'text', required: true },
      { key: 'address.addressLocality', label: 'City', type: 'text', required: true },
      { key: 'address.addressRegion', label: 'Region / state', type: 'text' },
      { key: 'address.postalCode', label: 'Postal code', type: 'text' },
      { key: 'address.addressCountry', label: 'Country (ISO code)', type: 'text', placeholder: 'IN' },
      { key: 'telephone', label: 'Phone', type: 'text', recommended: true },
      { key: 'geo.latitude', label: 'Latitude', type: 'number', recommended: true },
      { key: 'geo.longitude', label: 'Longitude', type: 'number', recommended: true },
      { key: 'openingHours', label: 'Opening hours', type: 'list', placeholder: 'Mo-Fr 09:00-18:00', recommended: true },
      { key: 'priceRange', label: 'Price range', type: 'text', placeholder: '₹₹' },
      image,
    ],
  },
  {
    type: 'Event',
    label: 'Event',
    group: 'Content',
    kind: 'entity',
    rich: 'yes',
    fields: [
      name,
      { key: 'startDate', label: 'Start', type: 'datetime', required: true },
      { key: 'endDate', label: 'End', type: 'datetime', recommended: true },
      { key: 'eventAttendanceMode', label: 'Attendance', type: 'select', options: ['OfflineEventAttendanceMode', 'OnlineEventAttendanceMode', 'MixedEventAttendanceMode'] },
      { key: 'eventStatus', label: 'Status', type: 'select', options: ['EventScheduled', 'EventPostponed', 'EventRescheduled', 'EventMovedOnline', 'EventCancelled'] },
      { key: 'location.name', label: 'Venue', type: 'text', required: true },
      { key: 'location.address.streetAddress', label: 'Venue street', type: 'text' },
      { key: 'location.address.addressLocality', label: 'Venue city', type: 'text' },
      { key: 'location.address.addressCountry', label: 'Venue country', type: 'text' },
      { key: 'organizer.name', label: 'Organizer', type: 'text', auto: 'Organization' },
      { key: 'performer.name', label: 'Performer', type: 'text' },
      ...price(),
      { key: 'offers.availability', label: 'Ticket availability', type: 'select', options: ['InStock', 'SoldOut', 'PreOrder'] },
      { key: 'offers.url', label: 'Ticket URL', type: 'url' },
      description,
      image,
    ],
  },
  {
    type: 'Course',
    label: 'Course',
    group: 'Content',
    kind: 'entity',
    rich: 'yes',
    note: 'Shown in course lists (needs 3+ courses marked up across the site).',
    fields: [
      name,
      { ...description, required: true },
      { key: 'provider.name', label: 'Provider', type: 'text', auto: 'Organization' },
      ...price(),
      { key: 'offers.category', label: 'Pricing', type: 'select', options: ['Free', 'Paid', 'Subscription', 'Partially Free'] },
      { key: 'hasCourseInstance.courseMode', label: 'Mode', type: 'select', options: ['Online', 'Onsite', 'Blended'] },
      { key: 'hasCourseInstance.courseWorkload', label: 'Workload', type: 'duration', placeholder: 'PT22H' },
    ],
  },
  {
    type: 'JobPosting',
    label: 'Job posting',
    group: 'Business',
    kind: 'entity',
    rich: 'yes',
    fields: [
      { key: 'title', label: 'Job title', type: 'text', required: true, auto: 'Page title' },
      { ...description, required: true },
      { key: 'datePosted', label: 'Posted', type: 'date', required: true },
      { key: 'validThrough', label: 'Apply before', type: 'datetime', recommended: true },
      { key: 'employmentType', label: 'Employment type', type: 'select', options: ['FULL_TIME', 'PART_TIME', 'CONTRACTOR', 'TEMPORARY', 'INTERN', 'VOLUNTEER', 'PER_DIEM', 'OTHER'], recommended: true },
      { key: 'jobLocationType', label: 'Remote', type: 'select', options: ['', 'TELECOMMUTE'] },
      { key: 'jobLocation.address.addressLocality', label: 'City', type: 'text', required: true },
      { key: 'jobLocation.address.addressRegion', label: 'Region', type: 'text' },
      { key: 'jobLocation.address.addressCountry', label: 'Country', type: 'text' },
      { key: 'applicantLocationRequirements.name', label: 'Remote: allowed country', type: 'text' },
      { key: 'baseSalary.currency', label: 'Salary currency', type: 'text', recommended: true },
      { key: 'baseSalary.value.value', label: 'Salary', type: 'number', recommended: true },
      { key: 'baseSalary.value.unitText', label: 'Salary per', type: 'select', options: ['HOUR', 'DAY', 'WEEK', 'MONTH', 'YEAR'] },
    ],
  },
  {
    type: 'Recipe',
    label: 'Recipe',
    group: 'Content',
    kind: 'entity',
    rich: 'yes',
    fields: [
      name,
      { ...image, required: true },
      description,
      { key: 'recipeIngredient', label: 'Ingredients', type: 'list', recommended: true },
      { key: 'recipeInstructions', label: 'Steps', type: 'list', recommended: true },
      { key: 'prepTime', label: 'Prep time', type: 'duration', placeholder: 'PT15M', recommended: true },
      { key: 'cookTime', label: 'Cook time', type: 'duration', placeholder: 'PT1H', recommended: true },
      { key: 'totalTime', label: 'Total time', type: 'duration', recommended: true },
      { key: 'recipeYield', label: 'Yield', type: 'text', placeholder: '4 servings', recommended: true },
      { key: 'recipeCategory', label: 'Category', type: 'text' },
      { key: 'recipeCuisine', label: 'Cuisine', type: 'text' },
      { key: 'nutrition.calories', label: 'Calories', type: 'text', placeholder: '270 calories' },
      { key: 'keywords', label: 'Keywords', type: 'list' },
      ...rating,
    ],
  },
  {
    type: 'SoftwareApplication',
    label: 'Software / app',
    group: 'Commerce',
    kind: 'entity',
    rich: 'yes',
    note: 'Needs a rating (or review) and a price (0 if free).',
    fields: [
      name,
      description,
      { key: 'applicationCategory', label: 'Category', type: 'select', options: ['BusinessApplication', 'DeveloperApplication', 'DesignApplication', 'EducationalApplication', 'FinanceApplication', 'GameApplication', 'HealthApplication', 'LifestyleApplication', 'MultimediaApplication', 'ProductivityApplication', 'SocialNetworkingApplication', 'TravelApplication', 'UtilitiesApplication'], recommended: true },
      { key: 'operatingSystem', label: 'Operating system', type: 'text', placeholder: 'Web, iOS, Android', recommended: true },
      ...price(true),
      ...rating.map((f) => ({ ...f, required: true })),
      image,
    ],
  },
  {
    type: 'VideoObject',
    label: 'Video',
    group: 'Media',
    kind: 'entity',
    rich: 'yes',
    fields: [
      name,
      { ...description, recommended: true },
      { key: 'thumbnailUrl', label: 'Thumbnail', type: 'image', required: true, auto: 'Share image' },
      { key: 'uploadDate', label: 'Upload date', type: 'datetime', required: true, auto: 'Published date' },
      { key: 'duration', label: 'Duration', type: 'duration', placeholder: 'PT2M30S', recommended: true },
      { key: 'contentUrl', label: 'Video file URL', type: 'url', recommended: true },
      { key: 'embedUrl', label: 'Embed URL', type: 'url', recommended: true },
    ],
  },
  {
    type: 'HowTo',
    label: 'How-to',
    group: 'Content',
    kind: 'entity',
    rich: 'retired',
    note: 'No longer a Google rich result. Still useful for AI answers.',
    fields: [name, description, { key: 'step', label: 'Steps', type: 'list', required: true }, { key: 'totalTime', label: 'Total time', type: 'duration' }, image],
  },
  {
    type: 'NGO',
    label: 'Non-profit / NGO',
    group: 'Business',
    kind: 'entity',
    rich: 'no',
    note: 'A charity or non-profit. Google has no NGO rich result; it feeds knowledge panels and AI answers. Pair with Donate on donation pages.',
    fields: [
      name,
      description,
      { key: 'url', label: 'Website', type: 'url' },
      { key: 'logo', label: 'Logo', type: 'image', recommended: true },
      { key: 'taxID', label: 'Charity / registration number', type: 'text', recommended: true },
      { key: 'foundingDate', label: 'Founded', type: 'date' },
      { key: 'sameAs', label: 'Profile links (one per line)', type: 'list', recommended: true, placeholder: 'https://www.wikidata.org/…' },
      ...address(),
    ],
  },
  {
    type: 'DonateAction',
    label: 'Donate (donation page)',
    group: 'Commerce',
    kind: 'entity',
    rich: 'no',
    note: 'Where and how to give. Use on a donation or appeal page.',
    fields: [
      name,
      { key: 'target', label: 'Donation URL', type: 'url', required: true },
      { key: 'recipient.name', label: 'Recipient (charity name)', type: 'text', required: true },
      { key: 'price', label: 'Suggested amount', type: 'number' },
      { key: 'priceCurrency', label: 'Currency', type: 'text', placeholder: 'INR, USD, EUR…' },
    ],
  },
  {
    type: 'Restaurant',
    label: 'Restaurant',
    group: 'Business',
    kind: 'entity',
    rich: 'yes',
    note: 'A restaurant location. Google uses LocalBusiness rules for it: hours, address and phone matter most.',
    fields: [
      name,
      description,
      image,
      ...address(true),
      { key: 'telephone', label: 'Phone', type: 'text', recommended: true },
      { key: 'servesCuisine', label: 'Cuisine', type: 'text', placeholder: 'Italian, South Indian…' },
      { key: 'priceRange', label: 'Price range', type: 'text', placeholder: '$$' },
      { key: 'menu', label: 'Menu URL', type: 'url' },
      { key: 'openingHours', label: 'Opening hours (one per line)', type: 'list', recommended: true, placeholder: 'Mo-Fr 09:00-22:00' },
    ],
  },
  {
    type: 'RealEstateListing',
    label: 'Property listing',
    group: 'Commerce',
    kind: 'entity',
    rich: 'no',
    note: 'A property for sale or rent. Read by AI assistants and property portals; no Google rich result.',
    fields: [
      name,
      description,
      image,
      { key: 'url', label: 'Listing URL', type: 'url' },
      { key: 'datePosted', label: 'Listed on', type: 'date' },
      ...price(true),
      ...address(true),
      { key: 'numberOfBedrooms', label: 'Bedrooms', type: 'number' },
      { key: 'numberOfBathroomsTotal', label: 'Bathrooms', type: 'number' },
    ],
  },
  {
    type: 'GovernmentService',
    label: 'Public service',
    group: 'Business',
    kind: 'entity',
    rich: 'no',
    note: 'A service run by a government body: permits, registrations, benefits.',
    fields: [
      name,
      description,
      { key: 'url', label: 'Service URL', type: 'url' },
      { key: 'provider.name', label: 'Government body', type: 'text', required: true },
      { key: 'serviceType', label: 'Service type', type: 'text', placeholder: 'Passport renewal' },
      { key: 'areaServed', label: 'Area served', type: 'text', placeholder: 'Karnataka' },
      { key: 'audience', label: 'Who it is for', type: 'text' },
    ],
  },
];

export const schemaType = (type: string | undefined) => SCHEMA_TYPES.find((t) => t.type === type);
