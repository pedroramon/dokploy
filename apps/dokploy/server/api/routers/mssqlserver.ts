import { EventEmitter } from "node:events";
import {
	createTRPCRouter,
	protectedProcedure,
} from "@/server/api/trpc";
import {
	apiChangeMsqlserverStatus,
	apiCreateMsqlserver,
	apiDeployMsqlserver,
	apiFindOneMsqlserver,
	apiResetMsqlserver,
	apiSaveEnvironmentVariablesMsqlserver,
	apiSaveExternalPortMsqlserver,
	apiUpdateMsqlserver,
} from "@/server/db/schema";
import {
	IS_CLOUD,
	addNewService,
	checkServiceAccess,
	createMount,
	createMssqlserver,
	deployMssqlserver,
	findMssqlserverById,
	findProjectById,
	removeMssqlserverById,
	removeService,
	startService,
	startServiceRemote,
	stopService,
	stopServiceRemote,
	updateMssqlserverById,
} from "@dokploy/server";
import { TRPCError } from "@trpc/server";
import { observable } from "@trpc/server/observable";

const ee = new EventEmitter();

export const mssqlserverRouter = createTRPCRouter({
	create: protectedProcedure
		.input(apiCreateMsqlserver)
		.mutation(async ({ input, ctx }) => {
			try {
				if (ctx.user.rol === "user") {
					await checkServiceAccess(ctx.user.authId, input.projectId, "create");
				}

				if (IS_CLOUD && !input.serverId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You need to use a server to create a SQL Server",
					});
				}

				const project = await findProjectById(input.projectId);
				if (project.adminId !== ctx.user.adminId) {
					throw new TRPCError({
						code: "UNAUTHORIZED",
						message: "You are not authorized to access this project",
					});
				}
				const newMssqlserver = await createMssqlserver(input);
				if (ctx.user.rol === "user") {
					await addNewService(ctx.user.authId, newMssqlserver.mssqlserverId);
				}

				await createMount({
					serviceId: newMssqlserver.mssqlserverId,
					serviceType: "mssqlserver",
					volumeName: `${newMssqlserver.appName}-data`,
					mountPath: "/var/opt/mssql",
					type: "volume",
				});

				return true;
			} catch (error) {
				if (error instanceof TRPCError) {
					throw error;
				}
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error input: Inserting SQL Server database",
					cause: error,
				});
			}
		}),
	one: protectedProcedure
		.input(apiFindOneMsqlserver)
		.query(async ({ input, ctx }) => {
			if (ctx.user.rol === "user") {
				await checkServiceAccess(ctx.user.authId, input.mssqlserverId, "access");
			}

			const mssqlserver = await findMssqlserverById(input.mssqlserverId);
			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to access this SQL Server",
				});
			}
			return mssqlserver;
		}),

	start: protectedProcedure
		.input(apiFindOneMsqlserver)
		.mutation(async ({ input, ctx }) => {
			const service = await findMssqlserverById(input.mssqlserverId);

			if (service.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to start this SQL Server",
				});
			}

			if (service.serverId) {
				await startServiceRemote(service.serverId, service.appName);
			} else {
				await startService(service.appName);
			}
			await updateMssqlserverById(input.mssqlserverId, {
				applicationStatus: "done",
			});

			return service;
		}),
	stop: protectedProcedure
		.input(apiFindOneMsqlserver)
		.mutation(async ({ input, ctx }) => {
			const mssqlserver = await findMssqlserverById(input.mssqlserverId);
			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to stop this SQL Server",
				});
			}
			if (mssqlserver.serverId) {
				await stopServiceRemote(mssqlserver.serverId, mssqlserver.appName);
			} else {
				await stopService(mssqlserver.appName);
			}
			await updateMssqlserverById(input.mssqlserverId, {
				applicationStatus: "idle",
			});

			return mssqlserver;
		}),
	saveExternalPort: protectedProcedure
		.input(apiSaveExternalPortMsqlserver)
		.mutation(async ({ input, ctx }) => {
			const mssqlserver = await findMssqlserverById(input.mssqlserverId);

			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to save this external port",
				});
			}
			await updateMssqlserverById(input.mssqlserverId, {
				externalPort: input.externalPort,
			});
			await deployMssqlserver(input.mssqlserverId);
			return mssqlserver;
		}),
	deploy: protectedProcedure
		.input(apiDeployMsqlserver)
		.mutation(async ({ input, ctx }) => {
			const mssqlserver = await findMssqlserverById(input.mssqlserverId);
			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to deploy this SQL Server",
				});
			}
			return deployMssqlserver(input.mssqlserverId);
		}),

	deployWithLogs: protectedProcedure
		.meta({
			openapi: {
				path: "/deploy/mssqlserver-with-logs",
				method: "POST",
				override: true,
				enabled: false,
			},
		})
		.input(apiDeployMsqlserver)
		.subscription(async ({ input, ctx }) => {
			const mssqlserver = await findMssqlserverById(input.mssqlserverId);
			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to deploy this SQL Server",
				});
			}
			return observable<string>((emit) => {
				deployMssqlserver(input.mssqlserverId, (log) => {
					emit.next(log);
				});
			});
		}),

	changeStatus: protectedProcedure
		.input(apiChangeMsqlserverStatus)
		.mutation(async ({ input, ctx }) => {
			const mssqlserver = await findMssqlserverById(input.mssqlserverId);
			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to change this SQL Server status",
				});
			}
			await updateMssqlserverById(input.mssqlserverId, {
				applicationStatus: input.applicationStatus,
			});
			return mssqlserver;
		}),
	remove: protectedProcedure
		.input(apiFindOneMsqlserver)
		.mutation(async ({ input, ctx }) => {
			if (ctx.user.rol === "user") {
				await checkServiceAccess(ctx.user.authId, input.mssqlserverId, "delete");
			}
			const mssqlserver = await findMssqlserverById(input.mssqlserverId);

			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to delete this SQL Server",
				});
			}

			const cleanupOperations = [
				removeService(mssqlserver.appName, mssqlserver.serverId),
				removeMssqlserverById(input.mssqlserverId),
			];

			await Promise.allSettled(cleanupOperations);

			return mssqlserver;
		}),
	saveEnvironment: protectedProcedure
		.input(apiSaveEnvironmentVariablesMsqlserver)
		.mutation(async ({ input, ctx }) => {
			const mssqlserver = await findMssqlserverById(input.mssqlserverId);
			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to save this environment",
				});
			}
			const service = await updateMssqlserverById(input.mssqlserverId, {
				env: input.env,
			});

			if (!service) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error adding environment variables",
				});
			}

			return true;
		}),
	reload: protectedProcedure
		.input(apiResetMsqlserver)
		.mutation(async ({ input, ctx }) => {
			const mssqlserver = await findMssqlserverById(input.mssqlserverId);
			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to reload this SQL Server",
				});
			}
			if (mssqlserver.serverId) {
				await stopServiceRemote(mssqlserver.serverId, mssqlserver.appName);
			} else {
				await stopService(mssqlserver.appName);
			}
			await updateMssqlserverById(input.mssqlserverId, {
				applicationStatus: "idle",
			});

			if (mssqlserver.serverId) {
				await startServiceRemote(mssqlserver.serverId, mssqlserver.appName);
			} else {
				await startService(mssqlserver.appName);
			}
			await updateMssqlserverById(input.mssqlserverId, {
				applicationStatus: "done",
			});
			return true;
		}),
	update: protectedProcedure
		.input(apiUpdateMsqlserver)
		.mutation(async ({ input, ctx }) => {
			const { mssqlserverId, ...rest } = input;
			const mssqlserver = await findMssqlserverById(mssqlserverId);
			if (mssqlserver.project.adminId !== ctx.user.adminId) {
				throw new TRPCError({
					code: "UNAUTHORIZED",
					message: "You are not authorized to update this SQL Server",
				});
			}
			const service = await updateMssqlserverById(mssqlserverId, {
				...rest,
			});

			if (!service) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: "Error updating SQL Server",
				});
			}

			return true;
		}),
});
