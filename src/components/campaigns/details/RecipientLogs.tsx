import type { CampaignRecipient } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface RecipientLogsProps {
    recipients: CampaignRecipient[];
}

export const RecipientLogs = ({ recipients }: RecipientLogsProps) => {
    const errorLogs = recipients.filter(r => r.status === 'failed').slice(0, 50); // Show latest 50
    const successLogs = recipients.filter(r => r.status === 'success').slice(0, 10); // Show latest 10

    return (
        <div className="grid md:grid-cols-2 gap-4">
            <Card>
                <CardHeader><CardTitle>Error Logs</CardTitle></CardHeader>
                <CardContent>
                    {errorLogs.length === 0 ? <p>No errors reported.</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User ID</TableHead>
                                    <TableHead>Error</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {errorLogs.map(log => (
                                    <TableRow key={log.userId}>
                                        <TableCell>{log.userId}</TableCell>
                                        <TableCell className="text-destructive text-xs">{log.error}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Recent Successful Sends</CardTitle></CardHeader>
                <CardContent>
                     {successLogs.length === 0 ? <p>No successful sends yet.</p> : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>User ID</TableHead>
                                    <TableHead>Status</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {successLogs.map(log => (
                                    <TableRow key={log.userId}>
                                        <TableCell>{log.userId}</TableCell>
                                        <TableCell><Badge>Success</Badge></TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}; 