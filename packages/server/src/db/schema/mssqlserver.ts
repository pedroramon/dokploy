import { relations } from "drizzle-orm";
import { integer, pgTable, text } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { nanoid } from "nanoid";
import { z } from "zod";
import { backups } from "./backups";
import { mounts } from "./mount";
import { projects } from "./project";
import { server } from "./server";
import { applicationStatus } from "./shared";
import { generateAppName } from "./utils";

export const mssqlserver = pgTable("mssqlserver", {
	mssqlserverId: text("mssqlserverId")
		.notNull()
		.primaryKey()
		.$defaultFn(() => nanoid()),
	name: text("name").notNull(),
	appName: text("appName")
		.notNull()
		.$defaultFn(() => generateAppName("sql-server"))
		.unique(),
	databaseName: text("databaseName").notNull(),
	databaseUser: text("databaseUser").notNull(),
	databasePassword: text("databasePassword").notNull(),
	databaseRootPassword: text("rootPassword").notNull(),
	description: text("description"),
	dockerImage: text("dockerImage").notNull(),
	command: text("command"),
	env: text("env"),
	memoryReservation: text("memoryReservation"),
	externalPort: integer("externalPort"),
	memoryLimit: text("memoryLimit"),
	cpuReservation: text("cpuReservation"),
	cpuLimit: text("cpuLimit"),
	applicationStatus: applicationStatus("applicationStatus")
		.notNull()
		.default("idle"),
	createdAt: text("createdAt")
		.notNull()
		.$defaultFn(() => new Date().toISOString()),
	projectId: text("projectId")
		.notNull()
		.references(() => projects.projectId, { onDelete: "cascade" }),
	serverId: text("serverId").references(() => server.serverId, {
		onDelete: "cascade",
	}),
});

export const mssqlserverRelations = relations(mssqlserver, ({ one, many }) => ({
	project: one(projects, {
		fields: [mssqlserver.projectId],
		references: [projects.projectId],
	}),
	backups: many(backups),
	mounts: many(mounts),
	server: one(server, {
		fields: [mssqlserver.serverId],
		references: [server.serverId],
	}),
}));

const createSchema = createInsertSchema(mssqlserver, {
	mssqlserverId: z.string(),
	name: z.string().min(1),
	databasePassword: z.string(),
	databaseRootPassword: z.string().optional(),
	databaseName: z.string().min(1),
	databaseUser: z.string().min(1),
	dockerImage: z.string().default("mcr.microsoft.com/mssql/server:2022-latest"),
	command: z.string().optional(),
	env: z.string().optional(),
	memoryReservation: z.string().optional(),
	memoryLimit: z.string().optional(),
	cpuReservation: z.string().optional(),
	cpuLimit: z.string().optional(),
	projectId: z.string(),
	applicationStatus: z.enum(["idle", "running", "done", "error"]),
	externalPort: z.number(),
	createdAt: z.string(),
	description: z.string().optional(),
	serverId: z.string().optional(),
});

export const apiCreateMsqlserver = createSchema
	.pick({
		name: true,
		appName: true,
		databaseName: true,
		databaseUser: true,
		databasePassword: true,
		databaseRootPassword: true,
		dockerImage: true,
		projectId: true,
		description: true,
		serverId: true,
	})
	.required();

export const apiFindOneMsqlserver = createSchema
	.pick({
		mssqlserverId: true,
	})
	.required();

export const apiChangeMsqlserverStatus = createSchema
	.pick({
		mssqlserverId: true,
		applicationStatus: true,
	})
	.required();

export const apiSaveEnvironmentVariablesMsqlserver = createSchema
	.pick({
		mssqlserverId: true,
		env: true,
	})
	.required();

export const apiSaveExternalPortMsqlserver = createSchema
	.pick({
		mssqlserverId: true,
		externalPort: true,
	})
	.required();

export const apiDeployMsqlserver = createSchema
	.pick({
		mssqlserverId: true,
	})
	.required();

export const apiResetMsqlserver = createSchema
	.pick({
		mssqlserverId: true,
		appName: true,
	})
	.required();

export const apiUpdateMsqlserver = createSchema
	.partial()
	.extend({
		mssqlserverId: z.string().min(1),
	})
	.omit({ serverId: true });
