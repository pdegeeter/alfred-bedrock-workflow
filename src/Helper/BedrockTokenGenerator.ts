import { createHash, createHmac } from "node:crypto";

import type { AwsCredentials } from "../Type/AwsCredentials.js";

/**
 * Generates Bedrock short-term API keys from AWS credentials.
 * Byte-for-byte equivalent to @aws/bedrock-token-generator: a SigV4 presigned
 * `CallWithBearerToken` URL, base64-encoded and prefixed.
 */
export class BedrockTokenGenerator {
  static readonly MAX_TTL_SECONDS = 43200;

  private static readonly ALGORITHM = "AWS4-HMAC-SHA256";
  private static readonly HOST = "bedrock.amazonaws.com";
  private static readonly PREFIX = "bedrock-api-key-";
  private static readonly SERVICE = "bedrock";
  private static readonly VERSION = "&Version=1";

  private readonly region: string;

  /**
   * @param region - AWS region the keys will be used in
   */
  constructor(region: string) {
    this.region = region;
  }

  /**
   * Generates a short-term API key bound to the region.
   * @param credentials - Credentials used to sign the key
   * @returns The bearer token
   */
  generate(credentials: AwsCredentials): string {
    const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, "");
    const dateStamp = amzDate.slice(0, 8);
    const scope = `${dateStamp}/${this.region}/${BedrockTokenGenerator.SERVICE}/aws4_request`;

    const params: Record<string, string> = {
      Action: "CallWithBearerToken",
      "X-Amz-Algorithm": BedrockTokenGenerator.ALGORITHM,
      "X-Amz-Credential": `${credentials.accessKeyId}/${scope}`,
      "X-Amz-Date": amzDate,
      "X-Amz-Expires": String(BedrockTokenGenerator.MAX_TTL_SECONDS),
      "X-Amz-SignedHeaders": "host",
    };
    if (credentials.sessionToken) {
      params["X-Amz-Security-Token"] = credentials.sessionToken;
    }

    const canonicalRequest = [
      "POST",
      "/",
      BedrockTokenGenerator.buildQuery(params),
      `host:${BedrockTokenGenerator.HOST}`,
      "",
      "host",
      BedrockTokenGenerator.sha256(""),
    ].join("\n");

    const stringToSign = [
      BedrockTokenGenerator.ALGORITHM,
      amzDate,
      scope,
      BedrockTokenGenerator.sha256(canonicalRequest),
    ].join("\n");

    const signingKey = [dateStamp, this.region, BedrockTokenGenerator.SERVICE, "aws4_request"].reduce<Buffer>(
      (key, part) => BedrockTokenGenerator.hmac(key, part),
      Buffer.from(`AWS4${credentials.secretAccessKey}`)
    );
    params["X-Amz-Signature"] = BedrockTokenGenerator.hmac(signingKey, stringToSign).toString("hex");

    const url = `${BedrockTokenGenerator.HOST}/?${BedrockTokenGenerator.buildQuery(params)}${BedrockTokenGenerator.VERSION}`;

    return `${BedrockTokenGenerator.PREFIX}${Buffer.from(url, "utf-8").toString("base64")}`;
  }

  private static buildQuery(params: Record<string, string>): string {
    return Object.keys(params)
      .sort()
      .map((key) => `${BedrockTokenGenerator.encode(key)}=${BedrockTokenGenerator.encode(params[key])}`)
      .join("&");
  }

  private static encode(value: string): string {
    return encodeURIComponent(value).replace(
      /[!'()*]/g,
      (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`
    );
  }

  private static hmac(key: Buffer, data: string): Buffer {
    return createHmac("sha256", key).update(data, "utf-8").digest();
  }

  private static sha256(data: string): string {
    return createHash("sha256").update(data, "utf-8").digest("hex");
  }
}
