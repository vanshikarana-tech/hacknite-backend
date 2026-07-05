-- CreateEnum
CREATE TYPE "ScanType" AS ENUM ('URL', 'CODE', 'GITHUB');

-- CreateEnum
CREATE TYPE "Severity" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "Principle" AS ENUM ('PERCEIVABLE', 'OPERABLE', 'UNDERSTANDABLE', 'ROBUST');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT,
    "name" TEXT,
    "provider" TEXT NOT NULL DEFAULT 'email',
    "providerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scans" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "scanType" "ScanType" NOT NULL,
    "targetUrl" TEXT,
    "targetRepo" TEXT,
    "codeSnippet" TEXT,
    "score" INTEGER NOT NULL,
    "perceivableScore" INTEGER NOT NULL DEFAULT 100,
    "operableScore" INTEGER NOT NULL DEFAULT 100,
    "understandableScore" INTEGER NOT NULL DEFAULT 100,
    "robustScore" INTEGER NOT NULL DEFAULT 100,
    "screenshotUrl" TEXT,
    "domSnapshot" TEXT,
    "truncated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "issues" (
    "id" TEXT NOT NULL,
    "scanId" TEXT NOT NULL,
    "wcagCriterion" TEXT NOT NULL,
    "wcagName" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "selector" TEXT,
    "lineNumber" INTEGER,
    "severity" "Severity" NOT NULL,
    "principle" "Principle" NOT NULL,
    "filePath" TEXT,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "appliedFix" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chat_messages" (
    "id" TEXT NOT NULL,
    "userId" TEXT,
    "scanId" TEXT,
    "issueId" TEXT,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chat_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- AddForeignKey
ALTER TABLE "scans" ADD CONSTRAINT "scans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "issues" ADD CONSTRAINT "issues_scanId_fkey" FOREIGN KEY ("scanId") REFERENCES "scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
