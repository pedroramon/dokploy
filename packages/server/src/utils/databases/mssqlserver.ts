import type { InferResultType } from "@dokploy/server/types/with";
import type { CreateServiceOptions } from "dockerode";
import {
	calculateResources,
	generateBindMounts,
	generateFileMounts,
	generateVolumeMounts,
	prepareEnvironmentVariables,
} from "../docker/utils";
import { getRemoteDocker } from "../servers/remote-docker";

export type MssqlserverNested = InferResultType<
	"mssqlserver",
	{ mounts: true; project: true }
>;
export const buildMssqlserver = async (mssqlserver: MssqlserverNested) => {
	const {
		appName,
		env,
		externalPort,
		dockerImage,
		memoryLimit,
		memoryReservation,
		cpuLimit,
		cpuReservation,
		databaseRootPassword,
		command,
		mounts,
	} = mssqlserver;

	const defaultMssqlserverEnv = [
		`MSSQL_SA_PASSWORD=${databaseRootPassword}`,
		env ? env : "",
	].join('\n');

	const resources = calculateResources({
		memoryLimit,
		memoryReservation,
		cpuLimit,
		cpuReservation,
	});
	const envVariables = prepareEnvironmentVariables(
		defaultMssqlserverEnv,
		mssqlserver.project.env,
	);
	const volumesMount = generateVolumeMounts(mounts);
	const bindsMount = generateBindMounts(mounts);
	const filesMount = generateFileMounts(appName, mssqlserver);

	const docker = await getRemoteDocker(mssqlserver.serverId);

	const settings: CreateServiceOptions = {
		Name: appName,
		TaskTemplate: {
			ContainerSpec: {
				Image: dockerImage,
				Env: envVariables,
				Mounts: [...volumesMount, ...bindsMount, ...filesMount],
				...(command
					? {
						Command: ["/bin/sh"],
						Args: ["-c", command],
					}
					: {}),
			},
			Networks: [{ Target: "dokploy-network" }],
			Resources: {
				...resources,
			},
			Placement: {
				Constraints: ["node.role==manager"],
			},
		},
		Mode: {
			Replicated: {
				Replicas: 1,
			},
		},
		EndpointSpec: {
			Mode: "dnsrr",
			Ports: externalPort
				? [
					{
						Protocol: "tcp",
						TargetPort: 5432,
						PublishedPort: externalPort,
						PublishMode: "host",
					},
				]
				: [],
		},
	};
	try {
		const service = docker.getService(appName);
		const inspect = await service.inspect();
		await service.update({
			version: Number.parseInt(inspect.Version.Index),
			...settings,
		});
	} catch (error) {
		console.log("error", error);
		await docker.createService(settings);
	}
};
