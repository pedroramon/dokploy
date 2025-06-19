ALTER TYPE "databaseType" ADD VALUE 'mssqlserver';--> statement-breakpoint
ALTER TYPE "serviceType" ADD VALUE 'mssqlserver';--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "mssqlserver" (
	"mssqlserverId" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"appName" text NOT NULL,
	"databaseName" text NOT NULL,
	"databaseUser" text NOT NULL,
	"databasePassword" text NOT NULL,
	"rootPassword" text NOT NULL,
	"description" text,
	"dockerImage" text NOT NULL,
	"command" text,
	"env" text,
	"memoryReservation" text,
	"externalPort" integer,
	"memoryLimit" text,
	"cpuReservation" text,
	"cpuLimit" text,
	"applicationStatus" "applicationStatus" DEFAULT 'idle' NOT NULL,
	"createdAt" text NOT NULL,
	"projectId" text NOT NULL,
	"serverId" text,
	CONSTRAINT "mssqlserver_appName_unique" UNIQUE("appName")
);
--> statement-breakpoint
ALTER TABLE "backup" ADD COLUMN "mssqlserverId" text;--> statement-breakpoint
ALTER TABLE "mount" ADD COLUMN "mssqlserverId" text;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mssqlserver" ADD CONSTRAINT "mssqlserver_projectId_project_projectId_fk" FOREIGN KEY ("projectId") REFERENCES "public"."project"("projectId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mssqlserver" ADD CONSTRAINT "mssqlserver_serverId_server_serverId_fk" FOREIGN KEY ("serverId") REFERENCES "public"."server"("serverId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "backup" ADD CONSTRAINT "backup_mssqlserverId_mssqlserver_mssqlserverId_fk" FOREIGN KEY ("mssqlserverId") REFERENCES "public"."mssqlserver"("mssqlserverId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "mount" ADD CONSTRAINT "mount_mssqlserverId_mssqlserver_mssqlserverId_fk" FOREIGN KEY ("mssqlserverId") REFERENCES "public"."mssqlserver"("mssqlserverId") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
