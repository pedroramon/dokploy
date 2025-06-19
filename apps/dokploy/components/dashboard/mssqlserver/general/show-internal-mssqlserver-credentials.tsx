import { ToggleVisibilityInput } from "@/components/shared/toggle-visibility-input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api } from "@/utils/api";
import React from "react";

interface Props {
	mssqlserverId: string;
}
export const ShowInternalMssqlserverCredentials = ({ mssqlserverId }: Props) => {
	const { data } = api.mssqlserver.one.useQuery({ mssqlserverId });
	return (
		<>
			<div className="flex w-full flex-col gap-5 ">
				<Card className="bg-background">
					<CardHeader>
						<CardTitle className="text-xl">Internal Credentials</CardTitle>
					</CardHeader>
					<CardContent className="flex w-full flex-row gap-4">
						<div className="grid w-full md:grid-cols-2 gap-4 md:gap-8">
							<div className="flex flex-col gap-2">
								<Label>User</Label>
								<Input disabled value={data?.databaseUser} />
							</div>
							<div className="flex flex-col gap-2">
								<Label>Database Name</Label>
								<Input disabled value={data?.databaseName} />
							</div>
							<div className="flex flex-col gap-2">
								<Label>Password</Label>
								<div className="flex flex-row gap-4">
									<ToggleVisibilityInput
										value={data?.databasePassword}
										disabled
									/>
								</div>
							</div>
							<div className="flex flex-col gap-2">
								<Label>Internal Port (Container)</Label>
								<Input disabled value="1433" />
							</div>

							<div className="flex flex-col gap-2">
								<Label>Internal Host</Label>
								<Input disabled value={data?.appName} />
							</div>

							<div className="flex flex-col gap-2">
								<Label>Internal Connection URL </Label>
								<ToggleVisibilityInput
									disabled
									value={`User ID=${data?.databaseUser};Password=${data?.databasePassword}@Data Source=${data?.appName},1433;Initial Catalog=${data?.databaseName};Encrypt=False;TrustServerCertificate=True;`}
								/>
							</div>
						</div>
					</CardContent>
				</Card>
			</div>
		</>
	);
};
