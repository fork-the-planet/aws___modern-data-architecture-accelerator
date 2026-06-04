import { CfnIPSet, CfnLoggingConfiguration, CfnWebACL } from 'aws-cdk-lib/aws-wafv2';
import { Construct } from 'constructs';
import { MdaaLogGroup } from '@aws-mdaa/cloudwatch-constructs';
import { RetentionDays } from 'aws-cdk-lib/aws-logs';
import { MdaaKmsKey } from '@aws-mdaa/kms-constructs';
import { MdaaL3Construct, MdaaL3ConstructProps } from '@aws-mdaa/l3-construct';

/**
 * WAF rule configuration with priority.
 *
 * Used by {@link WafProps.wafRules} in the parent GAIA configuration to
 * override the default priority of individual managed-rule groups, which is
 * required when combining multiple rule groups whose default priorities
 * would otherwise conflict.
 */
export interface WafRulesProps {
  /** Priority order for the WAF rule */
  readonly priority: number;
}

/**
 * Per-user rate limiting configuration.
 *
 * Adds a second rate-based rule that aggregates request counts on the value of the `authorization`
 * header (the Cognito-issued bearer token) rather than on source IP. This enforces a per-principal
 * limit that survives distributed clients or shared NAT — the scenario where many users share one
 * egress IP, or one abusive client spreads requests across many IPs. Only applied for `REGIONAL`
 * scope (API Gateway); CloudFront-scoped WAFs front the UI where this header is not present.
 *
 * @see https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-aggregate-keys.html
 */
export interface PerUserRateLimitConfig {
  /**
   * Whether per-user (Authorization header) rate limiting is enabled.
   * Has effect only on `REGIONAL`-scoped WAFs.
   *
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * Maximum requests allowed per distinct `authorization` header value within the evaluation window.
   * When exceeded, requests bearing that token are blocked until the rate drops below the limit.
   *
   * @default 600
   * @minimum 10
   * @maximum 2000000000
   */
  readonly limit?: number;

  /**
   * Time window in seconds for counting per-user requests.
   *
   * @default 60 (1 minute)
   * @allowedValues 60, 120, 300, 600
   */
  readonly evaluationWindowSec?: 60 | 120 | 300 | 600;

  /**
   * Priority for the per-user rate limit rule in the WAF rule evaluation order.
   * Must be unique across all rules and is reserved by default.
   *
   * @default 1
   */
  readonly priority?: number;
}

/**
 * Rate limiting configuration for DDoS and abuse protection.
 *
 * Rate-based rules help protect against DDoS and authenticated denial-of-service by automatically
 * blocking IP addresses (and, optionally, individual users) that exceed a request threshold within
 * a time window.
 *
 * IMPORTANT: Rate-based rules are evaluated **before** the IP allowlist rule so that an abusive but
 * allowlisted IP (or token) is still blocked. The allowlist rule's terminating `Allow` action would
 * otherwise short-circuit evaluation before any rate rule could fire. Built-in rules reserve
 * priorities 0 (per-IP), 1 (per-user), and 2 (IP allowlist); assign any `wafRules` priorities of 3
 * or higher (10+ recommended).
 *
 * @see https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html
 *
 * @example
 * // Block IPs making more than 1000 requests per minute
 * rateLimit: {
 *   limit: 1000,
 *   evaluationWindowSec: 60,
 * }
 *
 * @example
 * // Opt out of rate limiting entirely
 * rateLimit: { enabled: false }
 */
export interface RateLimitConfig {
  /**
   * Whether per-IP rate limiting is enabled. Rate limiting is on by default; set this to `false`
   * to opt out (for example, when rate limiting is managed centrally via AWS Firewall Manager).
   *
   * @default true
   */
  readonly enabled?: boolean;

  /**
   * Maximum requests allowed per IP within the evaluation window.
   * When exceeded, the IP is blocked until the request rate drops below the limit.
   *
   * @default 2000
   * @minimum 10
   * @maximum 2000000000
   */
  readonly limit?: number;

  /**
   * Priority for the per-IP rate limit rule in the WAF rule evaluation order.
   * Lower numbers are evaluated first. Must be unique across all rules.
   * Evaluated before the IP allowlist rule (priority 2) so abusive allowlisted IPs are still blocked.
   *
   * @default 0
   */
  readonly priority?: number;

  /**
   * Time window in seconds for counting requests.
   * AWS WAF counts requests within this sliding window to determine if the limit is exceeded.
   *
   * @default 300 (5 minutes)
   * @allowedValues 60, 120, 300, 600
   */
  readonly evaluationWindowSec?: 60 | 120 | 300 | 600;

  /**
   * Per-user (Authorization header) rate limiting. Adds a second rate-based rule keyed on the bearer
   * token so a single authenticated client cannot exhaust capacity even from many IPs. Applied only
   * to `REGIONAL`-scoped WAFs (API Gateway).
   *
   * @default - per-user rate limiting enabled with default limits on REGIONAL scope
   */
  readonly perUser?: PerUserRateLimitConfig;
}

export interface WAFProps extends MdaaL3ConstructProps {
  /** List of allowed CIDR blocks for IP-based access control */
  allowedCidrs?: string[];
  /** Custom WAF rules with priorities */
  wafRules?: { [key: string]: WafRulesProps };
  /** KMS key for encrypting WAF logs */
  encryptionKey: MdaaKmsKey;
  /** WAF scope - CLOUDFRONT for global, REGIONAL for API Gateway */
  wafScope: 'CLOUDFRONT' | 'REGIONAL';
  /** Prefix for WAF resource names */
  wafNamePrefix: string;
  /** Number of days to retain access logs in CloudWatch log group for access logs. If undefined, infinite is used. */
  readonly logGroupAccessLogRetentionDays?: number;
  /**
   * Rate limiting configuration for DDoS and authenticated-abuse protection.
   *
   * Rate limiting is enabled by default (secure-by-default): if this is undefined, a per-IP
   * rate-based rule with default limits is applied, plus a per-user (Authorization header) rule on
   * `REGIONAL` scope. Opt out entirely with `{ enabled: false }`.
   */
  readonly rateLimit?: RateLimitConfig;
  /**
   * Enable CloudWatch metrics for the IP allowlist rule.
   *
   * By default, metrics are disabled for the IP allowlist rule to reduce CloudWatch costs,
   * since this rule fires on every allowed request (high volume). Blocking rules (rate limit,
   * managed rules) always have metrics enabled regardless of this setting.
   *
   * Enable this for full observability when debugging access issues or for compliance/audit requirements.
   *
   * @default false
   */
  readonly enableIpAllowRuleMetrics?: boolean;
  /**
   * Enable request sampling for the IP allowlist rule.
   *
   * By default, sampling is disabled for the IP allowlist rule to reduce costs,
   * since this rule fires on every allowed request (high volume). Blocking rules (rate limit,
   * managed rules) always have sampling enabled regardless of this setting.
   *
   * Enable this to capture sample requests for debugging or analysis.
   *
   * @default false
   */
  readonly enableIpAllowRuleSampling?: boolean;
}

/**
 * WAF construct that creates Web Application Firewall protection for GAIA resources.
 *
 * This construct creates:
 * - WAF Web ACL with configurable rules
 * - IP Set for allowed CIDR blocks (default deny, explicit allow)
 * - Rate-based rules for DDoS protection (optional)
 * - AWS Managed Rule Groups for common attack protection
 * - CloudWatch logging for security monitoring
 * - Metrics and sampling for analysis
 *
 * Security Features:
 * - Default deny policy (block all traffic not explicitly allowed)
 * - IP-based access control with CIDR allowlists
 * - Rate limiting to mitigate DDoS and brute-force attacks
 * - AWS Managed Rules for OWASP Top 10 protection
 * - Request sampling and metrics for monitoring
 * - Encrypted logging for compliance
 *
 * @see https://docs.aws.amazon.com/waf/latest/developerguide/waf-chapter.html
 * @see https://docs.aws.amazon.com/whitepapers/latest/aws-best-practices-ddos-resiliency/aws-waf-rate-based-rules.html
 */
export class Waf extends MdaaL3Construct {
  /**
   * Default priority for the per-IP rate-based rule. Evaluated first so an abusive IP is blocked
   * before the terminating IP-allowlist rule can let it through.
   */
  private static readonly PER_IP_RATE_PRIORITY = 0;
  /** Default priority for the per-user (Authorization header) rate-based rule. */
  private static readonly PER_USER_RATE_PRIORITY = 1;
  /**
   * Default priority for the IP allowlist rule. Moved after the rate-based rules (was 0) so that
   * rate limiting is actually enforced against allowlisted traffic — a terminating `Allow` would
   * otherwise short-circuit evaluation before any rate rule runs.
   */
  private static readonly IP_ALLOW_PRIORITY = 2;

  /** WAF Web ACL for traffic filtering */
  readonly webACL: CfnWebACL;

  constructor(scope: Construct, id: string, props: WAFProps) {
    super(scope, id, props);

    // Build WAF rules. Order matters: rate-based blocking rules must be evaluated BEFORE the
    // IP-allowlist rule, whose `Allow` action terminates rule evaluation. If the allow ran first,
    // an allowlisted-but-abusive IP (or token) would never reach the rate rules — exactly the gap
    // the NetSPI finding exercised with a single valid token at 400+ rps.
    const rules: CfnWebACL.RuleProperty[] = [];

    // Rate limiting is on by default (secure-by-default); opt out with rateLimit.enabled === false.
    if (props.rateLimit?.enabled !== false) {
      rules.push(this.configureRateLimitRule(props.wafNamePrefix, props));

      // Per-user rate limiting only applies to REGIONAL (API Gateway) scope, where the
      // Authorization bearer token is present. CloudFront-scoped WAFs front the UI distributions.
      if (props.wafScope === 'REGIONAL' && props.rateLimit?.perUser?.enabled !== false) {
        rules.push(this.configurePerUserRateLimitRule(props.wafNamePrefix, props));
      }
    }

    // IP allowlist evaluated after the rate rules (see ordering note above), then any
    // user-configured managed rule groups.
    rules.push(this.configureIpSetRule(scope, props.wafNamePrefix, props), ...this.addUserConfiguredRules(props));

    // Fail fast on priority collisions — duplicate priorities are rejected by WAF at deploy time,
    // but surfacing it at synth gives a far clearer message pointing at the offending config.
    this.assertUniquePriorities(rules);

    // Create WAF Web ACL with default deny policy
    const cfnWebACL = new CfnWebACL(scope, `${props.wafNamePrefix}-default-waf`, {
      name: props.naming.resourceName(`${props.wafNamePrefix}-default-waf`, 128),
      defaultAction: {
        block: {}, // Default deny - only explicitly allowed traffic passes
      },
      scope: props.wafScope, // CLOUDFRONT for global, REGIONAL for API Gateway
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: props.naming.resourceName(`${props.wafNamePrefix}-default-waf`, 255),
        sampledRequestsEnabled: true, // Enable request sampling for analysis
      },
      rules: rules,
    });

    this.webACL = cfnWebACL;

    // Configure CloudWatch logging for security monitoring
    this.configureLogs(scope, props.wafNamePrefix, props, cfnWebACL);
  }

  /**
   * Creates IP Set rules for CIDR-based access control
   * This method creates separate IP sets for IPv4 and IPv6 addresses and combines them
   * using an OR statement. Traffic from any allowed IP range is permitted.
   *
   * @returns Array of rule properties (one combined rule if both IPv4 and IPv6 are present)
   */
  private configureIpSetRule(scope: Construct, wafNamePrefix: string, props: WAFProps) {
    // Warn if no CIDRs are configured - this will block ALL traffic due to default deny policy
    if (!props.allowedCidrs || props.allowedCidrs.length === 0) {
      console.warn(
        `[WAF WARNING] No allowedCidrs configured for ${wafNamePrefix}. ` +
          'With default deny policy, ALL traffic will be blocked. ' +
          'If this is intentional, you can ignore this warning.',
      );
    }

    // Separate IPv4 and IPv6 addresses
    // IPv6 addresses contain colons, IPv4 addresses contain dots
    const ipv4Addresses = (props.allowedCidrs || []).filter(cidr => !cidr.includes(':'));
    const ipv6Addresses = (props.allowedCidrs || []).filter(cidr => cidr.includes(':'));

    const ipSetStatements: CfnWebACL.StatementProperty[] = [];

    // Create IPv4 IP Set if there are IPv4 addresses
    if (ipv4Addresses.length > 0) {
      const ipv4AllowSet = new CfnIPSet(scope, `${wafNamePrefix}ipv4-allow-set`, {
        addresses: ipv4Addresses,
        ipAddressVersion: 'IPV4',
        scope: props.wafScope,
        name: props.naming.resourceName(`${wafNamePrefix}-ipv4-allow-set`, 255),
      });
      ipSetStatements.push({
        ipSetReferenceStatement: {
          arn: ipv4AllowSet.attrArn,
        },
      });
    }

    // Create IPv6 IP Set if there are IPv6 addresses
    if (ipv6Addresses.length > 0) {
      const ipv6AllowSet = new CfnIPSet(scope, `${wafNamePrefix}ipv6-allow-set`, {
        addresses: ipv6Addresses,
        ipAddressVersion: 'IPV6',
        scope: props.wafScope,
        name: props.naming.resourceName(`${wafNamePrefix}-ipv6-allow-set`, 255),
      });
      ipSetStatements.push({
        ipSetReferenceStatement: {
          arn: ipv6AllowSet.attrArn,
        },
      });
    }

    // Build the statement - use OR if both IPv4 and IPv6, single statement otherwise
    let statement: CfnWebACL.StatementProperty;
    if (ipSetStatements.length === 0) {
      // No addresses configured - create empty IPv4 set (will block all traffic)
      const emptyIpSet = new CfnIPSet(scope, `${wafNamePrefix}ip-allow-set`, {
        addresses: [],
        ipAddressVersion: 'IPV4',
        scope: props.wafScope,
        name: props.naming.resourceName(`${wafNamePrefix}-ip-allow-set`, 255),
      });
      statement = {
        ipSetReferenceStatement: {
          arn: emptyIpSet.attrArn,
        },
      };
    } else if (ipSetStatements.length === 1) {
      // Only one type of IP addresses
      statement = ipSetStatements[0];
    } else {
      // Both IPv4 and IPv6 - combine with OR
      statement = {
        orStatement: {
          statements: ipSetStatements,
        },
      };
    }

    // Create rule that allows traffic from IP Sets
    // Metrics and sampling disabled by default for allow rules to reduce costs (fires on every allowed request)
    // Users can enable individually for observability/debugging
    const ipAllowRuleProps: CfnWebACL.RuleProperty = {
      name: 'ipAllow',
      priority: Waf.IP_ALLOW_PRIORITY, // Evaluated after rate-based rules (see constructor ordering note)
      visibilityConfig: {
        cloudWatchMetricsEnabled: props.enableIpAllowRuleMetrics ?? false,
        metricName: props.naming.resourceName(`${wafNamePrefix}-ip-allow`, 255),
        sampledRequestsEnabled: props.enableIpAllowRuleSampling ?? false,
      },
      statement,
      action: {
        allow: {}, // Allow traffic from these IPs
      },
    };
    return ipAllowRuleProps;
  }

  /**
   * Creates rate-based rule for DDoS protection.
   *
   * This rule tracks requests per source IP and blocks IPs that exceed the configured
   * limit within the evaluation window. Blocked IPs receive a 403 Forbidden response
   * and remain blocked until their request rate drops below the threshold.
   *
   * @see https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based.html
   */
  private configureRateLimitRule(wafNamePrefix: string, props: WAFProps): CfnWebACL.RuleProperty {
    const limit = props.rateLimit?.limit ?? 2000;
    const priority = props.rateLimit?.priority ?? Waf.PER_IP_RATE_PRIORITY;
    const evaluationWindowSec = props.rateLimit?.evaluationWindowSec ?? 300;

    return {
      name: 'RateLimitRule',
      priority: priority,
      statement: {
        rateBasedStatement: {
          limit: limit,
          aggregateKeyType: 'IP', // Rate limit per source IP address
          evaluationWindowSec: evaluationWindowSec,
        },
      },
      action: {
        block: {}, // Block IPs exceeding the limit
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${wafNamePrefix}-rate-limit`,
        sampledRequestsEnabled: true, // Sample blocked requests for analysis
      },
    };
  }

  /**
   * Creates a per-user rate-based rule that aggregates request counts on the `authorization` header
   * (the Cognito bearer token) rather than source IP. This enforces a per-principal limit that holds
   * even when a single client distributes requests across many IPs, or when many users share one NAT
   * egress IP — directly addressing the authenticated-DoS scenario where one valid token sustained
   * 400+ rps.
   *
   * Applied only to REGIONAL (API Gateway) scope; callers gate on scope before invoking this.
   *
   * @see https://docs.aws.amazon.com/waf/latest/developerguide/waf-rule-statement-type-rate-based-aggregate-keys.html
   */
  private configurePerUserRateLimitRule(wafNamePrefix: string, props: WAFProps): CfnWebACL.RuleProperty {
    const perUser = props.rateLimit?.perUser;
    const limit = perUser?.limit ?? 600;
    const priority = perUser?.priority ?? Waf.PER_USER_RATE_PRIORITY;
    const evaluationWindowSec = perUser?.evaluationWindowSec ?? 60;

    return {
      name: 'RateLimitPerAuthorizationToken',
      priority: priority,
      statement: {
        rateBasedStatement: {
          limit: limit,
          aggregateKeyType: 'CUSTOM_KEYS',
          evaluationWindowSec: evaluationWindowSec,
          customKeys: [
            {
              header: {
                name: 'authorization',
                // No transformation: the bearer token is matched verbatim so each distinct token
                // forms its own aggregation instance. Requests with no Authorization header are
                // omitted from this rule's evaluation (handled by Cognito auth / default deny).
                textTransformations: [{ priority: 0, type: 'NONE' }],
              },
            },
          ],
        },
      },
      action: {
        block: {}, // Block tokens exceeding the per-user limit
      },
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: `${wafNamePrefix}-rate-limit-per-user`,
        sampledRequestsEnabled: true,
      },
    };
  }

  /**
   * Validates that all assembled rules have unique priorities, throwing a descriptive error at synth
   * time if not. Built-in rules reserve priorities 0 (per-IP rate), 1 (per-user rate), and 2 (IP
   * allowlist); user-supplied `wafRules` priorities must avoid these.
   */
  private assertUniquePriorities(rules: CfnWebACL.RuleProperty[]): void {
    const seen = new Map<number, string>();
    for (const rule of rules) {
      const existing = seen.get(rule.priority);
      if (existing !== undefined) {
        throw new Error(
          `WAF rule priority collision: "${rule.name}" and "${existing}" both use priority ${rule.priority}. ` +
            'Built-in rules reserve priorities 0 (per-IP rate limit), 1 (per-user rate limit), and 2 (IP allowlist). ' +
            'Assign wafRules priorities of 3 or higher (10+ recommended).',
        );
      }
      seen.set(rule.priority, rule.name);
    }
  }

  /**
   * Adds user-configured AWS Managed Rule Groups
   * These provide protection against common web attacks (OWASP Top 10, etc.)
   */
  private addUserConfiguredRules(props: WAFProps) {
    const rules: CfnWebACL.RuleProperty[] = [];

    // Process each configured managed rule group
    for (const ruleName of Object.keys(props?.wafRules ?? {})) {
      const wafRule: WafRulesProps | undefined = props?.wafRules?.[ruleName];
      if (wafRule) {
        rules.push({
          name: ruleName,
          priority: wafRule.priority, // User-defined priority for rule evaluation order
          overrideAction: {
            none: {}, // Use rule group's default actions
          },
          statement: {
            managedRuleGroupStatement: {
              vendorName: 'AWS', // AWS Managed Rules
              name: ruleName, // e.g., 'AWSManagedRulesCommonRuleSet'
            },
          },
          visibilityConfig: {
            sampledRequestsEnabled: true,
            cloudWatchMetricsEnabled: true,
            metricName: `${props.wafNamePrefix}-${ruleName}`,
          },
        });
      }
    }
    return rules;
  }

  /**
   * Configures CloudWatch logging for WAF.
   * Logs are encrypted and retention is configurable (defaults to infinite if not specified).
   */
  private configureLogs(scope: Construct, wafNamePrefix: string, props: WAFProps, cfnWebACL: CfnWebACL) {
    // Create encrypted log group for WAF logs
    const defaultWafLogGroup = new MdaaLogGroup(scope, `${wafNamePrefix}-default-waf-log-group`, {
      logGroupName: `${wafNamePrefix}-default-waf`,
      encryptionKey: props.encryptionKey,
      // IMPORTANT: WAF log group names must start with 'aws-waf-logs-'
      // This is an AWS requirement for WAF logging destinations
      // https://docs.aws.amazon.com/waf/latest/developerguide/logging-cw-logs.html
      logGroupNamePathPrefix: 'aws-waf-logs-',
      retention: props.logGroupAccessLogRetentionDays ?? RetentionDays.INFINITE,
      naming: props.naming,
      createParams: false,
      createOutputs: false,
    });

    // Configure WAF to send logs to CloudWatch
    new CfnLoggingConfiguration(scope, `${wafNamePrefix}-default-waf-logging-config`, {
      logDestinationConfigs: [defaultWafLogGroup.logGroupArn],
      resourceArn: cfnWebACL.attrArn,
      // CDK uses objectToCloudFormation (pass-through) for singleHeader in
      // CfnLoggingConfiguration.FieldToMatchProperty, so we must use CFN PascalCase directly.
      redactedFields: [
        { singleHeader: { Name: 'authorization' } },
        { singleHeader: { Name: 'x-origin-verify' } },
        { singleHeader: { Name: 'cookie' } },
      ],
    });
  }
}
