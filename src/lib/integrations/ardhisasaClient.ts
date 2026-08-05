/**
 * ARDHISASA API Integration Client
 * Handles submission of survey data and retrieval of official records
 * from Kenya's land information systems.
 *
 * Usage:
 *   import { createArdhisasaClient, isArdhisasaConfigured } from './ardhisasa/ardhisasaClient';
 *
 *   if (isArdhisasaConfigured()) {
 *     const client = createArdhisasaClient();
 *     const result = await client.submitPlan(planData);
 *   }
 */

// ---------------------------------------------------------------------------
// Configuration & types
// ---------------------------------------------------------------------------

export interface ArdhisasaConfig {
  apiKey: string;
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  environment: 'production' | 'sandbox' | 'demo';
}

export interface SubmissionResult {
  success: boolean;
  submissionId: string;
  trackingNumber: string;
  status: 'SUBMITTED' | 'PROCESSING' | 'APPROVED' | 'REJECTED';
  submittedAt: string;
  estimatedProcessingDays: number;
  remarks?: string;
  errors?: string[];
}

export interface RecordSearchResult {
  records: Array<{
    prnNumber: string;
    titleNumber: string;
    landReference: string;
    registry: string;
    size: number;
    ownerName: string;
    status: 'REGISTERED' | 'PENDING' | 'DISPUTED' | 'TRANSMITTED';
    lastUpdated: string;
  }>;
  totalResults: number;
  page: number;
  pageSize: number;
}

export interface SurveySubmissionData {
  // Plan details
  planNumber: string;
  planType: 'DEED_PLAN' | 'RIM' | 'TOPOGRAPHIC' | 'ENGINEERING';

  // Surveyor info
  surveyorName: string;
  iskNumber: string;
  firmName: string;
  firmAddress: string;

  // Location
  county: string;
  subCounty: string;
  ward: string;

  // Parcel details
  parcels: Array<{
    parcelNumber: string;
    area: number;
    landUse: string;
    beaconCount: number;
    coordinates: { easting: number; northing: number }[];
  }>;

  // Document references
  deedPlanNumber?: string;
  rimNumber?: string;
  previousPlanNumber?: string;

  // Supporting documents (Base64-encoded or file references)
  surveyReport?: string;
  beaconSchedule?: string;
  consentForms?: string;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ValidationWarning {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface SubmissionRequirements {
  requiredDocuments: string[];
  requiredFields: string[];
  feeEstimate: number;
  processingTime: string;
}

export interface CountyInfo {
  code: string;
  name: string;
}

export interface PlanTypeInfo {
  code: string;
  name: string;
  description: string;
}

export interface RecordSearchQuery {
  prnNumber?: string;
  titleNumber?: string;
  landReference?: string;
  ownerName?: string;
  county?: string;
  page?: number;
  pageSize?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const REQUEST_TIMEOUT_MS = 30_000;

/** Required fields that apply to every plan type. */
const BASE_REQUIRED_FIELDS: (keyof SurveySubmissionData)[] = [
  'planNumber',
  'planType',
  'surveyorName',
  'iskNumber',
  'firmName',
  'firmAddress',
  'county',
  'subCounty',
  'ward',
  'parcels',
];

/** Additional fields required per plan type. */
const PLAN_TYPE_REQUIRED_FIELDS: Record<string, (keyof SurveySubmissionData)[]> = {
  DEED_PLAN: ['deedPlanNumber', 'beaconSchedule', 'surveyReport', 'consentForms'],
  RIM: ['rimNumber', 'surveyReport'],
  TOPOGRAPHIC: ['surveyReport'],
  ENGINEERING: ['surveyReport'],
};

/** Documents required per plan type. */
const PLAN_TYPE_REQUIRED_DOCUMENTS: Record<string, string[]> = {
  DEED_PLAN: [
    'Signed deed plan (PDF)',
    'Beacon schedule',
    'Survey report',
    'Consent forms from all registered proprietors',
    'Copy of surveyor ISK licence',
    'Certified search certificate (not older than 3 months)',
  ],
  RIM: [
    'Signed RIM (PDF)',
    'Survey report',
    'Copy of surveyor ISK licence',
    'Certified search certificate (not older than 3 months)',
  ],
  TOPOGRAPHIC: [
    'Topographic survey map',
    'Survey report',
    'Control point coordinates',
    'Copy of surveyor ISK licence',
  ],
  ENGINEERING: [
    'Engineering survey plan',
    'Survey report',
    'Design drawings (if applicable)',
    'Copy of surveyor ISK licence',
  ],
};

/** Standardised validation error codes. */
const VALIDATION_ERROR_CODES = {
  REQUIRED: 'FIELD_REQUIRED',
  FORMAT: 'INVALID_FORMAT',
  RANGE: 'OUT_OF_RANGE',
  LENGTH: 'INVALID_LENGTH',
  REFERENCE: 'INVALID_REFERENCE',
  PAYLOAD: 'INVALID_PAYLOAD',
} as const;

/** Kenyan county registry (code + name). */
const KENYAN_COUNTIES: CountyInfo[] = [
  { code: '01', name: 'Mombasa' },
  { code: '02', name: 'Kwale' },
  { code: '03', name: 'Kilifi' },
  { code: '04', name: 'Tana River' },
  { code: '05', name: 'Taita-Taveta' },
  { code: '06', name: 'Garissa' },
  { code: '07', name: 'Wajir' },
  { code: '08', name: 'Mandera' },
  { code: '09', name: 'Marsabit' },
  { code: '10', name: 'Isiolo' },
  { code: '11', name: 'Meru' },
  { code: '12', name: 'Tharaka-Nithi' },
  { code: '13', name: 'Embu' },
  { code: '14', name: 'Kitui' },
  { code: '15', name: 'Machakos' },
  { code: '16', name: 'Makueni' },
  { code: '17', name: 'Nyandarua' },
  { code: '18', name: 'Nyeri' },
  { code: '19', name: 'Kirinyaga' },
  { code: '20', name: 'Murang\'a' },
  { code: '21', name: 'Kiambu' },
  { code: '22', name: 'Turkana' },
  { code: '23', name: 'West Pokot' },
  { code: '24', name: 'Samburu' },
  { code: '25', name: 'Trans-Nzoia' },
  { code: '26', name: 'Uasin Gishu' },
  { code: '27', name: 'Elgeyo-Marakwet' },
  { code: '28', name: 'Nandi' },
  { code: '29', name: 'Baringo' },
  { code: '30', name: 'Laikipia' },
  { code: '31', name: 'Nakuru' },
  { code: '32', name: 'Narok' },
  { code: '33', name: 'Kajiado' },
  { code: '34', name: 'Kericho' },
  { code: '35', name: 'Bomet' },
  { code: '36', name: 'Kakamega' },
  { code: '37', name: 'Vihiga' },
  { code: '38', name: 'Bungoma' },
  { code: '39', name: 'Busia' },
  { code: '40', name: 'Siaya' },
  { code: '41', name: 'Kisumu' },
  { code: '42', name: 'Homa Bay' },
  { code: '43', name: 'Migori' },
  { code: '44', name: 'Kisii' },
  { code: '45', name: 'Nyamira' },
  { code: '46', name: 'Nairobi' },
  { code: '47', name: 'Lamu' },
];

/** Plan type catalogue. */
const PLAN_TYPES: PlanTypeInfo[] = [
  { code: 'DEED_PLAN', name: 'Deed Plan', description: 'Detailed cadastral plan showing parcel boundaries, beacon positions, and measurements for land registration purposes.' },
  { code: 'RIM', name: 'Registry Index Map', description: 'Index map used by the land registry showing the spatial arrangement of parcels within a registration section.' },
  { code: 'TOPOGRAPHIC', name: 'Topographic Survey', description: 'Survey mapping natural and man-made features of the land surface including contours, elevations, and structures.' },
  { code: 'ENGINEERING', name: 'Engineering Survey', description: 'Precision survey for engineering construction projects including road design, building set-out, and infrastructure works.' },
];

/** Processing metadata per plan type (days / fee in KES). */
const PLAN_PROCESSING: Record<string, { days: number; fee: number }> = {
  DEED_PLAN: { days: 30, fee: 15_000 },
  RIM: { days: 21, fee: 10_000 },
  TOPOGRAPHIC: { days: 14, fee: 8_000 },
  ENGINEERING: { days: 14, fee: 8_000 },
};

// ---------------------------------------------------------------------------
// Custom errors
// ---------------------------------------------------------------------------

export class ArdhisasaError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ArdhisasaError';
  }
}

export class ArdhisasaAuthenticationError extends ArdhisasaError {
  constructor(message = 'ARDHISASA authentication failed') {
    super(message, 401, 'AUTH_FAILED');
    this.name = 'ArdhisasaAuthenticationError';
  }
}

export class ArdhisasaTimeoutError extends ArdhisasaError {
  constructor(endpoint: string) {
    super(`Request to ${endpoint} timed out after ${REQUEST_TIMEOUT_MS / 1000}s`, 0, 'TIMEOUT');
    this.name = 'ArdhisasaTimeoutError';
  }
}

// ---------------------------------------------------------------------------
// Token store (module-level, survives across client method calls)
// ---------------------------------------------------------------------------

interface TokenStore {
  accessToken: string | null;
  tokenExpiry: number;
}

const globalTokenStore: TokenStore = { accessToken: null, tokenExpiry: 0 };

// ---------------------------------------------------------------------------
// Raw JSON shapes returned by the ARDHISASA API (typed for fetch responses)
// ---------------------------------------------------------------------------

interface OAuthTokenResponse {
  access_token?: string
  accessToken?: string
  token?: string
  expires_in?: number
  expiresIn?: number
}

interface SubmissionApiResponse {
  submissionId?: string
  id?: string
  trackingNumber?: string
  referenceNumber?: string
  status?: SubmissionResult['status']
  submittedAt?: string
  estimatedProcessingDays?: number
  remarks?: string
  errors?: string[]
  success?: boolean
}

interface RecordSearchApiResponse {
  records?: Array<Record<string, unknown>>
  totalResults?: number
  page?: number
  pageSize?: number
}

interface CountiesApiResponse {
  counties?: unknown
  data?: unknown
}

interface PlanTypesApiResponse {
  planTypes?: unknown
  data?: unknown
}

interface RequirementsApiResponse {
  requiredDocuments?: string[]
  requiredFields?: string[]
  feeEstimate?: number
  processingTime?: string
}

// ---------------------------------------------------------------------------
// Client implementation
// ---------------------------------------------------------------------------

export class ArdhisasaClient {
  private config: ArdhisasaConfig;
  private tokenStore: TokenStore;

  constructor(config: ArdhisasaConfig, tokenStore?: TokenStore) {
    if (!config.baseUrl) {
      throw new ArdhisasaError('baseUrl is required in ArdhisasaConfig');
    }

    // Normalise trailing slash
    this.config = {
      ...config,
      baseUrl: config.baseUrl.replace(/\/+$/, ''),
    };

    // Per-instance token store, defaulting to the module-level singleton so
    // that multiple client instances created with the same credentials can
    // share a cached token.
    this.tokenStore = tokenStore ?? globalTokenStore;
  }

  // -----------------------------------------------------------------------
  // Authentication
  // -----------------------------------------------------------------------

  /**
   * Authenticate using OAuth2 client-credentials flow.
   *
   * POST {baseUrl}/oauth/token
   *   body: grant_type=client_credentials & client_id & client_secret
   *
   * Returns an access token string.
   */
  private async authenticate(): Promise<string> {
    // Only re-authenticate when the current token is missing or expired.
    const cached = this.tokenStore.accessToken
    if (cached && !this.isTokenExpired()) {
      return cached;
    }

    const url = `${this.config.baseUrl}/oauth/token`;

    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: body.toString(),
      });
    } catch (err) {
      if (err instanceof ArdhisasaTimeoutError) throw err;
      throw new ArdhisasaAuthenticationError(
        `Failed to reach ARDHISASA auth endpoint: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ArdhisasaAuthenticationError(
        `Authentication request returned ${response.status}: ${text || response.statusText}`,
      );
    }

    const data = (await response.json()) as OAuthTokenResponse;

    // Handle both standard OAuth2 and ARDHISASA-specific response shapes.
    const accessToken: string | undefined =
      data.access_token ?? data.accessToken ?? data.token;

    if (!accessToken) {
      throw new ArdhisasaAuthenticationError(
        'Authentication response did not contain an access_token',
      );
    }

    // Token lifetimes are expressed as `expires_in` (seconds) by default.
    const expiresIn: number = data.expires_in ?? data.expiresIn ?? 3600;
    // Expire 60 seconds early to avoid edge-case races.
    this.tokenStore.accessToken = accessToken;
    this.tokenStore.tokenExpiry = Date.now() + (expiresIn - 60) * 1000;

    return accessToken;
  }

  /** Returns `true` when no token is cached or it has expired. */
  private isTokenExpired(): boolean {
    if (!this.tokenStore.accessToken) return true;
    return Date.now() >= this.tokenStore.tokenExpiry;
  }

  // -----------------------------------------------------------------------
  // HTTP helpers
  // -----------------------------------------------------------------------

  /**
   * Wrapper around `fetch()` that enforces a 30-second timeout.
   * Rejects with `ArdhisasaTimeoutError` when the timeout fires.
   */
  private async fetchWithTimeout(
    url: string,
    init: RequestInit = {},
    timeoutMs: number = REQUEST_TIMEOUT_MS,
  ): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
      });
      return response;
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        throw new ArdhisasaTimeoutError(url);
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * Build common headers required for authenticated API calls.
   */
  private async buildAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.authenticate();

    return {
      Authorization: `Bearer ${token}`,
      'X-API-Key': this.config.apiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'X-Environment': this.config.environment,
    };
  }

  /**
   * Parse an HTTP error response into an `ArdhisasaError` with helpful context.
   */
  private async handleError(response: Response, context: string): Promise<never> {
    let body: string;
    try {
      body = await response.text();
    } catch {
      body = '';
    }

    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(body) as Record<string, unknown> | null;
    } catch {
      // non-JSON body - continue
    }

    const message = (parsed && (parsed["message"] || parsed["error"] || parsed["error_description"])) || body || response.statusText;

    throw new ArdhisasaError(
      `ARDHISASA ${context}: ${response.status} - ${message}`,
      response.status,
      parsed?.code as string | undefined,
      parsed?.details,
    );
  }

  // -----------------------------------------------------------------------
  // Core operations
  // -----------------------------------------------------------------------

  /**
   * Submit a survey plan to ARDHISASA.
   *
   * Flow:
   *  1. Run client-side validation first.
   *  2. POST to /submissions with the validated payload.
   *  3. Return the server's submission receipt.
   */
  async submitPlan(data: SurveySubmissionData): Promise<SubmissionResult> {
    // Pre-flight validation
    const validation = await this.validateSubmission(data);
    if (!validation.valid) {
      return {
        success: false,
        submissionId: '',
        trackingNumber: '',
        status: 'REJECTED',
        submittedAt: new Date().toISOString(),
        estimatedProcessingDays: 0,
        remarks: 'Submission failed client-side validation',
        errors: validation.errors.map((e) => `[${e.code}] ${e.field}: ${e.message}`),
      };
    }

    const url = `${this.config.baseUrl}/submissions`;
    const headers = await this.buildAuthHeaders();

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
      });
    } catch (err) {
      if (err instanceof ArdhisasaError) throw err;
      throw new ArdhisasaError(
        `Failed to reach ARDHISASA submissions endpoint: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      await this.handleError(response, 'submitPlan');
    }

    const result = (await response.json()) as SubmissionApiResponse;

    const processingInfo = PLAN_PROCESSING[data.planType] ?? { days: 21 };

    return {
      success: true,
      submissionId: result.submissionId ?? result.id ?? '',
      trackingNumber: result.trackingNumber ?? result.referenceNumber ?? '',
      status: (result.status as SubmissionResult['status']) ?? 'SUBMITTED',
      submittedAt: result.submittedAt ?? new Date().toISOString(),
      estimatedProcessingDays: result.estimatedProcessingDays ?? processingInfo.days,
      remarks: result.remarks,
      errors: result.errors,
    };
  }

  /**
   * Search ARDHISASA land records by various criteria.
   *
   * GET /records?prnNumber=...&titleNumber=...&county=...&page=...&pageSize=...
   */
  async searchRecords(query: RecordSearchQuery): Promise<RecordSearchResult> {
    const params = new URLSearchParams();

    if (query.prnNumber) params.set('prnNumber', query.prnNumber);
    if (query.titleNumber) params.set('titleNumber', query.titleNumber);
    if (query.landReference) params.set('landReference', query.landReference);
    if (query.ownerName) params.set('ownerName', query.ownerName);
    if (query.county) params.set('county', query.county);
    params.set('page', String(query.page ?? 1));
    params.set('pageSize', String(query.pageSize ?? 20));

    const url = `${this.config.baseUrl}/records?${params.toString()}`;
    const headers = await this.buildAuthHeaders();

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers,
      });
    } catch (err) {
      if (err instanceof ArdhisasaError) throw err;
      throw new ArdhisasaError(
        `Failed to reach ARDHISASA records endpoint: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      await this.handleError(response, 'searchRecords');
    }

    const body = (await response.json()) as RecordSearchApiResponse;

    return {
      records: (body.records ?? []).map((r: Record<string, unknown>) => ({
        prnNumber: (r.prnNumber as string) ?? '',
        titleNumber: (r.titleNumber as string) ?? '',
        landReference: (r.landReference as string) ?? '',
        registry: (r.registry as string) ?? '',
        size: Number(r.size) ?? 0,
        ownerName: (r.ownerName as string) ?? '',
        status: (r.status as RecordSearchResult['records'][0]['status']) ?? 'PENDING',
        lastUpdated: (r.lastUpdated as string) ?? '',
      })),
      totalResults: Number(body.totalResults) ?? 0,
      page: Number(body.page) ?? query.page ?? 1,
      pageSize: Number(body.pageSize) ?? query.pageSize ?? 20,
    };
  }

  /**
   * Check the status of a previously submitted plan.
   *
   * GET /submissions/{submissionId}/status
   */
  async getSubmissionStatus(submissionId: string): Promise<SubmissionResult> {
    if (!submissionId) {
      throw new ArdhisasaError('submissionId is required', 400, 'MISSING_PARAM');
    }

    const url = `${this.config.baseUrl}/submissions/${encodeURIComponent(submissionId)}/status`;
    const headers = await this.buildAuthHeaders();

    let response: Response;
    try {
      response = await this.fetchWithTimeout(url, {
        method: 'GET',
        headers,
      });
    } catch (err) {
      if (err instanceof ArdhisasaError) throw err;
      throw new ArdhisasaError(
        `Failed to reach ARDHISASA submission status endpoint: ${(err as Error).message}`,
      );
    }

    if (!response.ok) {
      await this.handleError(response, 'getSubmissionStatus');
    }

    const result = (await response.json()) as SubmissionApiResponse;

    return {
      success: result.success ?? true,
      submissionId: result.submissionId ?? submissionId,
      trackingNumber: result.trackingNumber ?? '',
      status: (result.status as SubmissionResult['status']) ?? 'PROCESSING',
      submittedAt: result.submittedAt ?? '',
      estimatedProcessingDays: Number(result.estimatedProcessingDays) ?? 0,
      remarks: result.remarks,
      errors: result.errors,
    };
  }

  /**
   * Client-side validation of a survey submission payload.
   *
   * Checks:
   *  - Base required fields are present and non-empty
   *  - Plan-type-specific required fields
   *  - Field formats (ISK number, coordinates, parcel area)
   *  - Business rules (beacon count consistency, coordinate arrays)
   *
   * Returns field-level errors and warnings.
   */
  async validateSubmission(data: SurveySubmissionData): Promise<ValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // --- Base required fields ------------------------------------------------
    for (const field of BASE_REQUIRED_FIELDS) {
      const value = data[field];
      if (value === undefined || value === null || value === '') {
        errors.push({
          field,
          message: `${field} is required`,
          code: VALIDATION_ERROR_CODES.REQUIRED,
        });
      }
    }

    // --- Plan-type-specific required fields ----------------------------------
    const extraFields = PLAN_TYPE_REQUIRED_FIELDS[data.planType] ?? [];
    for (const field of extraFields) {
      const value = data[field];
      if (value === undefined || value === null || value === '') {
        errors.push({
          field,
          message: `${field} is required for ${data.planType} submissions`,
          code: VALIDATION_ERROR_CODES.REQUIRED,
        });
      }
    }

    // --- Field-level format checks -------------------------------------------

    // ISK number (typically a numeric string, 5-10 digits)
    if (data.iskNumber && !/^\d{5,10}$/.test(data.iskNumber.trim())) {
      errors.push({
        field: 'iskNumber',
        message: 'ISK number must be 5-10 digits',
        code: VALIDATION_ERROR_CODES.FORMAT,
      });
    }

    // Plan number format
    if (data.planNumber && data.planNumber.trim().length < 3) {
      errors.push({
        field: 'planNumber',
        message: 'Plan number must be at least 3 characters',
        code: VALIDATION_ERROR_CODES.LENGTH,
      });
    }

    // Parcels array must not be empty
    if (Array.isArray(data.parcels) && data.parcels.length === 0) {
      errors.push({
        field: 'parcels',
        message: 'At least one parcel is required',
        code: VALIDATION_ERROR_CODES.REQUIRED,
      });
    }

    // Per-parcel validation
    if (Array.isArray(data.parcels)) {
      for (let i = 0; i < data.parcels.length; i++) {
        const parcel = data.parcels[i];
        const prefix = `parcels[${i}]`;

        if (!parcel.parcelNumber || parcel.parcelNumber.trim() === '') {
          errors.push({
            field: `${prefix}.parcelNumber`,
            message: `Parcel ${i + 1}: parcelNumber is required`,
            code: VALIDATION_ERROR_CODES.REQUIRED,
          });
        }

        if (typeof parcel.area !== 'number' || parcel.area <= 0) {
          errors.push({
            field: `${prefix}.area`,
            message: `Parcel ${i + 1}: area must be a positive number (hectares)`,
            code: VALIDATION_ERROR_CODES.RANGE,
          });
        }

        if (parcel.area > 100_000) {
          warnings.push({
            field: `${prefix}.area`,
            message: `Parcel ${i + 1}: unusually large area (${parcel.area} ha). Please verify.`,
          });
        }

        if (typeof parcel.beaconCount !== 'number' || parcel.beaconCount < 2) {
          errors.push({
            field: `${prefix}.beaconCount`,
            message: `Parcel ${i + 1}: at least 2 beacons are required`,
            code: VALIDATION_ERROR_CODES.RANGE,
          });
        }

        if (!Array.isArray(parcel.coordinates) || parcel.coordinates.length < 3) {
          errors.push({
            field: `${prefix}.coordinates`,
            message: `Parcel ${i + 1}: at least 3 coordinate points are required to define a boundary`,
            code: VALIDATION_ERROR_CODES.RANGE,
          });
        } else {
          for (let j = 0; j < parcel.coordinates.length; j++) {
            const coord = parcel.coordinates[j];
            const cprefix = `${prefix}.coordinates[${j}]`;

            if (typeof coord.easting !== 'number' || isNaN(coord.easting)) {
              errors.push({
                field: `${cprefix}.easting`,
                message: `Parcel ${i + 1}, point ${j + 1}: easting must be a valid number`,
                code: VALIDATION_ERROR_CODES.FORMAT,
              });
            }

            if (typeof coord.northing !== 'number' || isNaN(coord.northing)) {
              errors.push({
                field: `${cprefix}.northing`,
                message: `Parcel ${i + 1}, point ${j + 1}: northing must be a valid number`,
                code: VALIDATION_ERROR_CODES.FORMAT,
              });
            }
          }
        }

        // Kenya UTM coordinate sanity check
        if (Array.isArray(parcel.coordinates)) {
          for (const coord of parcel.coordinates) {
            if (typeof coord.easting === 'number' && typeof coord.northing === 'number') {
              // Kenya spans roughly: E 200 000 - 900 000, N 9 900 000 - 10 100 000 (UTM Zone 36/37)
              if (
                coord.easting < 100_000 ||
                coord.easting > 1_000_000 ||
                coord.northing < 9_800_000 ||
                coord.northing > 10_200_000
              ) {
                warnings.push({
                  field: `${prefix}.coordinates`,
                  message: `Parcel ${i + 1}: coordinate (E:${coord.easting}, N:${coord.northing}) appears outside typical Kenya UTM ranges. Verify datum and zone.`,
                });
              }
            }
          }
        }
      }
    }

    // --- County validation ---------------------------------------------------
    if (data.county) {
      const countyMatch = KENYAN_COUNTIES.find(
        (c) =>
          c.name.toLowerCase() === data.county.trim().toLowerCase() ||
          c.code === data.county.trim(),
      );
      if (!countyMatch) {
        warnings.push({
          field: 'county',
          message: `"${data.county}" does not match any known Kenyan county. Please verify.`,
        });
      }
    }

    // --- Valid plan type check -----------------------------------------------
    if (data.planType && !PLAN_TYPES.some((pt) => pt.code === data.planType)) {
      errors.push({
        field: 'planType',
        message: `Invalid plan type: ${data.planType}. Must be one of: ${PLAN_TYPES.map((pt) => pt.code).join(', ')}`,
        code: VALIDATION_ERROR_CODES.REFERENCE,
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // -----------------------------------------------------------------------
  // Utility / reference data methods
  // -----------------------------------------------------------------------

  /**
   * Get the list of supported Kenyan counties.
   *
   * In production this would call GET /reference/counties on the ARDHISASA API.
   * The response is cached in-memory after the first call.
   */
  async getSupportedCounties(): Promise<CountyInfo[]> {
    // Attempt live fetch first; fall back to static list.
    try {
      const url = `${this.config.baseUrl}/reference/counties`;
      const headers = await this.buildAuthHeaders();

      const response = await this.fetchWithTimeout(url, { method: 'GET', headers });

      if (response.ok) {
        const body = (await response.json()) as CountiesApiResponse;
        if (Array.isArray(body.counties ?? body.data ?? body)) {
          return (body.counties ?? body.data ?? body) as CountyInfo[];
        }
      }
      // Non-critical: fall through to static list
    } catch {
      // Swallow and fall back
    }

    return KENYAN_COUNTIES;
  }

  /**
   * Get the list of supported plan types.
   *
   * In production this would call GET /reference/plan-types.
   */
  async getPlanTypes(): Promise<PlanTypeInfo[]> {
    try {
      const url = `${this.config.baseUrl}/reference/plan-types`;
      const headers = await this.buildAuthHeaders();

      const response = await this.fetchWithTimeout(url, { method: 'GET', headers });

      if (response.ok) {
        const body = (await response.json()) as PlanTypesApiResponse;
        if (Array.isArray(body.planTypes ?? body.data ?? body)) {
          return (body.planTypes ?? body.data ?? body) as PlanTypeInfo[];
        }
      }
    } catch {
      // Swallow and fall back
    }

    return PLAN_TYPES;
  }

  /**
   * Get submission requirements (documents, fields, fees, processing time)
   * for a given plan type.
   *
   * In production this would call GET /reference/requirements/{planType}.
   */
  async getSubmissionRequirements(planType: string): Promise<SubmissionRequirements> {
    // Attempt live fetch
    try {
      const url = `${this.config.baseUrl}/reference/requirements/${encodeURIComponent(planType)}`;
      const headers = await this.buildAuthHeaders();

      const response = await this.fetchWithTimeout(url, { method: 'GET', headers });

      if (response.ok) {
        const body = (await response.json()) as RequirementsApiResponse;
        return {
          requiredDocuments: body.requiredDocuments ?? [],
          requiredFields: body.requiredFields ?? [],
          feeEstimate: Number(body.feeEstimate) ?? 0,
          processingTime: body.processingTime ?? '',
        };
      }
    } catch {
      // Swallow and fall back
    }

    // Static fallback
    const processing = PLAN_PROCESSING[planType] ?? { days: 21, fee: 10_000 };

    return {
      requiredDocuments: PLAN_TYPE_REQUIRED_DOCUMENTS[planType] ?? [],
      requiredFields: [
        ...BASE_REQUIRED_FIELDS,
        ...(PLAN_TYPE_REQUIRED_FIELDS[planType] ?? []),
      ],
      feeEstimate: processing.fee,
      processingTime: `${processing.days} working days`,
    };
  }
}

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

/**
 * Create an `ArdhisasaClient` from environment variables.
 *
 * Required env vars:
 *   - ARDHISASA_API_KEY
 *   - ARDHISASA_CLIENT_ID
 *   - ARDHISASA_CLIENT_SECRET
 *
 * Optional env vars (with defaults):
 *   - ARDHISASA_BASE_URL   → 'https://ardhisasa.go.ke/api/v1'
 *   - ARDHISASA_ENVIRONMENT → 'sandbox'
 */
export function createArdhisasaClient(): ArdhisasaClient {
  const apiKey = process.env.ARDHISASA_API_KEY;
  const clientId = process.env.ARDHISASA_CLIENT_ID;
  const clientSecret = process.env.ARDHISASA_CLIENT_SECRET;

  if (!apiKey || !clientId || !clientSecret) {
    throw new ArdhisasaError(
      'ARDHISASA integration is not fully configured. ' +
        'Set ARDHISASA_API_KEY, ARDHISASA_CLIENT_ID, and ARDHISASA_CLIENT_SECRET environment variables.',
      0,
      'NOT_CONFIGURED',
    );
  }

  const config: ArdhisasaConfig = {
    apiKey,
    baseUrl: process.env.ARDHISASA_BASE_URL ?? 'https://ardhisasa.go.ke/api/v1',
    clientId,
    clientSecret,
    environment: (process.env.ARDHISASA_ENVIRONMENT as ArdhisasaConfig['environment']) ?? 'sandbox',
  };

  return new ArdhisasaClient(config);
}

/**
 * Check whether the ARDHISASA integration is configured (env vars present).
 * Does NOT verify credentials against the server.
 */
export function isArdhisasaConfigured(): boolean {
  return !!(
    process.env.ARDHISASA_API_KEY &&
    process.env.ARDHISASA_CLIENT_ID &&
    process.env.ARDHISASA_CLIENT_SECRET
  );
}

// ---------------------------------------------------------------------------
// Status reporting (for admin UI)
// ---------------------------------------------------------------------------

/** In-memory tracking for the current process lifetime. */
let _lastSubmissionAt: string | undefined;
let _submissionCount = 0;

/** Internal: update tracking after each successful submission. */
export function _recordSubmission(submittedAt: string): void {
  _lastSubmissionAt = submittedAt;
  _submissionCount += 1;
}

/**
 * Get ARDHISASA configuration & usage status.
 * Useful for rendering an admin dashboard card.
 */
export function getArdhisasaStatus(): {
  configured: boolean;
  environment: string;
  lastSubmissionAt?: string;
  submissionCount: number;
} {
  return {
    configured: isArdhisasaConfigured(),
    environment:
      (process.env.ARDHISASA_ENVIRONMENT as string) ?? 'sandbox',
    lastSubmissionAt: _lastSubmissionAt,
    submissionCount: _submissionCount,
  };
}
