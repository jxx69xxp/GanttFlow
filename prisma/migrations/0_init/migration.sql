-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Settings" (
    "id" TEXT NOT NULL,
    "erpnextBaseUrl" TEXT,
    "erpnextApiKey" TEXT,
    "erpnextApiSecret" TEXT,
    "erpnextAuthMode" TEXT,
    "erpnextUsername" TEXT,
    "erpnextPassword" TEXT,
    "sprintKickoffUrl" TEXT,
    "sprintKickoffToken" TEXT,
    "sprintKickoffApiKey" TEXT,
    "sprintKickoffApiSecret" TEXT,
    "statusColors" TEXT,
    "syncIntervalMinutes" INTEGER NOT NULL DEFAULT 15,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamMember" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "passwordHash" TEXT,
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "role" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chart" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "viewMode" TEXT NOT NULL DEFAULT 'Week',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chart_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "assigneeEmail" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Not Started',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "projectName" TEXT,
    "sprintName" TEXT,
    "sprintId" TEXT,
    "chartId" TEXT,
    "isOverdue" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sprint" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Sprint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "taskId" TEXT,
    "sprintId" TEXT,
    "status" TEXT NOT NULL,
    "errorMsg" TEXT,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "tasksAdded" INTEGER NOT NULL DEFAULT 0,
    "tasksUpdated" INTEGER NOT NULL DEFAULT 0,
    "errors" INTEGER NOT NULL DEFAULT 0,
    "durationMs" INTEGER,
    "ranAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamMember_email_key" ON "TeamMember"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Task_externalId_key" ON "Task"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Sprint_externalId_key" ON "Sprint"("externalId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_chartId_fkey" FOREIGN KEY ("chartId") REFERENCES "Chart"("id") ON DELETE CASCADE ON UPDATE CASCADE;

