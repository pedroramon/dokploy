import { DialogAction } from "@/components/shared/dialog-action";
import { DrawerLogs } from "@/components/shared/drawer-logs";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/utils/api";
import { Ban, CheckCircle2, RefreshCcw, Terminal } from "lucide-react";
import React, { useState } from "react";
import { toast } from "sonner";
import { type LogLine, parseLogs } from "../../docker/logs/utils";
import { DockerTerminalModal } from "../../settings/web-server/docker-terminal-modal";
interface Props {
	mssqlserverId: string;
}

export const ShowGeneralMssqlserver = ({ mssqlserverId }: Props) => {
	const { data, refetch } = api.mssqlserver.one.useQuery(
		{
			mssqlserverId,
		},
		{ enabled: !!mssqlserverId },
	);

	const { mutateAsync: reload, isLoading: isReloading } =
		api.mssqlserver.reload.useMutation();

	const { mutateAsync: stop, isLoading: isStopping } =
		api.mssqlserver.stop.useMutation();

	const { mutateAsync: start, isLoading: isStarting } =
		api.mssqlserver.start.useMutation();

	const [isDrawerOpen, setIsDrawerOpen] = useState(false);
	const [filteredLogs, setFilteredLogs] = useState<LogLine[]>([]);
	const [isDeploying, setIsDeploying] = useState(false);
	api.mssqlserver.deployWithLogs.useSubscription(
		{
			mssqlserverId,
		},
		{
			enabled: isDeploying,
			onData(log) {
				if (!isDrawerOpen) {
					setIsDrawerOpen(true);
				}

				if (log === "Deployment completed successfully!") {
					setIsDeploying(false);
				}
				const parsedLogs = parseLogs(log);
				setFilteredLogs((prev) => [...prev, ...parsedLogs]);
			},
			onError(error) {
				console.error("Deployment logs error:", error);
				setIsDeploying(false);
			},
		},
	);

	return (
		<div className="flex w-full flex-col gap-5 ">
			<Card className="bg-background">
				<CardHeader className="pb-4">
					<CardTitle className="text-xl">General</CardTitle>
				</CardHeader>
				<CardContent className="flex gap-4">
					<DialogAction
						title="Deploy SQL Server"
						description="Are you sure you want to deploy this SQL Server?"
						type="default"
						onClick={async () => {
							setIsDeploying(true);

							await new Promise((resolve) => setTimeout(resolve, 1000));
							refetch();
						}}
					>
						<Button
							variant="default"
							isLoading={data?.applicationStatus === "running"}
						>
							Deploy
						</Button>
					</DialogAction>

					<DialogAction
						title="Reload SQL Server"
						description="Are you sure you want to reload this SQL Server?"
						type="default"
						onClick={async () => {
							await reload({
								mssqlserverId,
								appName: data?.appName || "",
							})
								.then(() => {
									toast.success("SQL Server reloaded successfully");
									refetch();
								})
								.catch(() => {
									toast.error("Error reloading SQL Server");
								});
						}}
					>
						<Button variant="secondary" isLoading={isReloading}>
							Reload
							<RefreshCcw className="size-4" />
						</Button>
					</DialogAction>
					{data?.applicationStatus === "idle" ? (
						<DialogAction
							title="Start SQL Server"
							description="Are you sure you want to start this SQL Server?"
							type="default"
							onClick={async () => {
								await start({
									mssqlserverId,
								})
									.then(() => {
										toast.success("SQL Server started successfully");
										refetch();
									})
									.catch(() => {
										toast.error("Error starting SQL Server");
									});
							}}
						>
							<Button variant="secondary" isLoading={isStarting}>
								Start
								<CheckCircle2 className="size-4" />
							</Button>
						</DialogAction>
					) : (
						<DialogAction
							title="Stop SQL Server"
							description="Are you sure you want to stop this SQL Server?"
							onClick={async () => {
								await stop({
									mssqlserverId,
								})
									.then(() => {
										toast.success("SQL Server stopped successfully");
										refetch();
									})
									.catch(() => {
										toast.error("Error stopping SQL Server");
									});
							}}
						>
							<Button variant="destructive" isLoading={isStopping}>
								Stop
								<Ban className="size-4" />
							</Button>
						</DialogAction>
					)}

					<DockerTerminalModal
						appName={data?.appName || ""}
						serverId={data?.serverId || ""}
					>
						<Button variant="outline">
							<Terminal />
							Open Terminal
						</Button>
					</DockerTerminalModal>
				</CardContent>
			</Card>
			<DrawerLogs
				isOpen={isDrawerOpen}
				onClose={() => {
					setIsDrawerOpen(false);
					setFilteredLogs([]);
					setIsDeploying(false);
					refetch();
				}}
				filteredLogs={filteredLogs}
			/>
		</div>
	);
};
