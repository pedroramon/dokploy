import path from "node:path";
import type { BackupSchedule } from "@dokploy/server/services/backup";
import type { Mssqlserver } from "@dokploy/server/services/mssqlserver";
import { findProjectById } from "@dokploy/server/services/project";
import {
	getRemoteServiceContainer,
	getServiceContainer,
} from "../docker/utils";
import { sendDatabaseBackupNotifications } from "../notifications/database-backup";
import { execAsync, execAsyncRemote } from "../process/execAsync";
import { getS3Credentials } from "./utils";

export const runMssqlserverBackup = async (
	mssqlserver: Mssqlserver,
	backup: BackupSchedule,
) => {
	const { appName, databaseRootPassword, name, projectId } = mssqlserver;
	const project = await findProjectById(projectId);

	const { prefix, database } = backup;
	const destination = backup.destination;
	const backupFileName = `${database}-${new Date().toISOString()}.bak`;
	const backupTmpPath = `/tmp/${backupFileName}`;
	const bucketDestination = path.join(prefix, backupFileName);
	try {
		const rcloneFlags = getS3Credentials(destination);
		const rcloneDestination = `:s3:${destination.bucket}/${bucketDestination}`;
		const rcloneCommand = `rclone copy ${backupTmpPath}.gz "${rcloneDestination}" ${rcloneFlags.join(" ")}`;

		const pgDumpCommand = (containerId: string) => [
			`docker exec ${containerId} /opt/mssql-tools18/bin/sqlcmd -S localhost -C -U SA -P '${databaseRootPassword}' -Q "BACKUP DATABASE [${database}] TO DISK = N'/var/opt/mssql/backup/${backupFileName}'"`,
			`docker cp ${containerId}:/var/opt/mssql/backup/${backupFileName} ${backupTmpPath}`,
			`gzip ${backupTmpPath}`,
			`${rcloneCommand}`,
			`rm ${backupTmpPath}.gz`,
		].join('\n');

		if (mssqlserver.serverId) {
			const { Id: containerId } = await getRemoteServiceContainer(
				mssqlserver.serverId,
				appName,
			);

			await execAsyncRemote(
				mssqlserver.serverId,
				`${pgDumpCommand(containerId)} | ${rcloneCommand}`,
			);
		} else {
			const { Id: containerId } = await getServiceContainer(appName);
			await execAsync(`${pgDumpCommand(containerId)} | ${rcloneCommand}`);
		}

		await sendDatabaseBackupNotifications({
			applicationName: name,
			projectName: project.name,
			databaseType: "mssqlserver",
			type: "success",
			adminId: project.adminId,
		});
	} catch (error) {
		await sendDatabaseBackupNotifications({
			applicationName: name,
			projectName: project.name,
			databaseType: "mssqlserver",
			type: "error",
			// @ts-ignore
			errorMessage: error?.message || "Error message not provided",
			adminId: project.adminId,
		});

		throw error;
	} finally {
	}
};

// Restore
// /Applications/pgAdmin 4.app/Contents/SharedSupport/pg_restore --host "localhost" --port "5432" --username "mauricio" --no-password --dbname "postgres" --verbose "/Users/mauricio/Downloads/_databases_2024-04-12T07_02_05.234Z.sql"
