import { defineConfig } from "hot-updater";
import { s3Storage, s3Database } from "@hot-updater/aws";
import { bare } from "@hot-updater/bare";
import dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  build: bare({ enableHermes: true }),
  storage: s3Storage({
    bucketName: process.env.S3_BUCKET_NAME!,
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  }),
  database: s3Database({
    bucketName: process.env.S3_BUCKET_NAME!,
    region: process.env.AWS_REGION!,
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
    },
  }),
});
