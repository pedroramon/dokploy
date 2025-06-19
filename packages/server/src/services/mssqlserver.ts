import { db } from "@dokploy/server/db";
import {
	type apiCreateMsqlserver,
	backups,
	mssqlserver,
} from "@dokploy/server/db/schema";
import { buildAppName, cleanAppName } from "@dokploy/server/db/schema";
import { generatePassword } from "@dokploy/server/templates/utils";
import { buildMssqlserver } from "@dokploy/server/utils/databases/mssqlserver";
import { pullImage } from "@dokploy/server/utils/docker/utils";
import { TRPCError } from "@trpc/server";
import { eq, getTableColumns } from "drizzle-orm";
import { validUniqueServerAppName } from "./project";

import { execAsyncRemote } from "@dokploy/server/utils/process/execAsync";

export type Mssqlserver = typeof mssqlserver.$inferSelect;

export const createMssqlserver = async (input: typeof apiCreateMsqlserver._type) => {
	const appName = buildAppName("mssqlserver", input.appName);

	const valid = await validUniqueServerAppName(appName);
	if (!valid) {
		throw new TRPCError({
			code: "CONFLICT",
			message: "Service with this 'AppName' already exists",
		});
	}

	const env = [
		'ACCEPT_EULA=Y',
		'MSSQL_PID=Express',
	].join("\n");

	const newMssqlserver = await db
		.insert(mssqlserver)
		.values({
			...input,
			env: env,
			databasePassword: input.databasePassword
				? input.databasePassword
				: generatePassword(),
			databaseRootPassword: input.databaseRootPassword
				? input.databaseRootPassword
				: generatePassword(),
			appName,
		})
		.returning()
		.then((value) => value[0]);

	if (!newMssqlserver) {
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: "Error input: Inserting SQL Server database",
		});
	}

	return newMssqlserver;
};
export const findMssqlserverById = async (mssqlserverId: string) => {
	const result = await db.query.mssqlserver.findFirst({
		where: eq(mssqlserver.mssqlserverId, mssqlserverId),
		with: {
			project: true,
			mounts: true,
			server: true,
			backups: {
				with: {
					destination: true,
				},
			},
		},
	});
	if (!result) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "SQL Server not found",
		});
	}
	return result;
};

export const findMssqlserverByBackupId = async (backupId: string) => {
	const result = await db
		.select({
			...getTableColumns(mssqlserver),
		})
		.from(mssqlserver)
		.innerJoin(backups, eq(mssqlserver.mssqlserverId, backups.mssqlserverId))
		.where(eq(backups.backupId, backupId))
		.limit(1);

	if (!result || !result[0]) {
		throw new TRPCError({
			code: "NOT_FOUND",
			message: "SQL Server not found",
		});
	}
	return result[0];
};

export const updateMssqlserverById = async (
	mssqlserverId: string,
	mssqlserverData: Partial<Mssqlserver>,
) => {
	const { appName, ...rest } = mssqlserverData;
	const result = await db
		.update(mssqlserver)
		.set({
			...rest,
		})
		.where(eq(mssqlserver.mssqlserverId, mssqlserverId))
		.returning();

	return result[0];
};

export const removeMssqlserverById = async (mssqlserverId: string) => {
	const result = await db
		.delete(mssqlserver)
		.where(eq(mssqlserver.mssqlserverId, mssqlserverId))
		.returning();

	return result[0];
};

export const deployMssqlserver = async (
	mssqlserverId: string,
	onData?: (data: any) => void,
) => {
	const mssqlserver = await findMssqlserverById(mssqlserverId);
	try {
		await updateMssqlserverById(mssqlserverId, {
			applicationStatus: "running",
		});

		onData?.("Starting SQL Server deployment...");

		if (mssqlserver.serverId) {
			await execAsyncRemote(
				mssqlserver.serverId,
				`docker pull ${mssqlserver.dockerImage}`,
				onData,
			);
		} else {
			await pullImage(mssqlserver.dockerImage, onData);
		}

		await buildMssqlserver(mssqlserver);

		await updateMssqlserverById(mssqlserverId, {
			applicationStatus: "done",
		});

		onData?.("Deployment completed successfully!");
	} catch (error) {
		onData?.(`Error: ${error}`);
		await updateMssqlserverById(mssqlserverId, {
			applicationStatus: "error",
		});
		throw new TRPCError({
			code: "INTERNAL_SERVER_ERROR",
			message: `Error on deploy SQL Server${error}`,
		});
	}
	return mssqlserver;
};
