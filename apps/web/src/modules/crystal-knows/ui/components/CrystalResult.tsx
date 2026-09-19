import { Clock, UserX } from "lucide-react";

type Props = {
    result: any;
};

export default function CrystalResult({ result }: Props) {
    if (result.state === "not_found") {
        return (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                <UserX className="w-5 h-5" />
                No Crystal profile found for this person.
            </div>
        );
    }

    if (result.state === "pending") {
        return (
            <div className="rounded-lg border border-dashed border-border bg-card p-6 mt-4 flex items-center gap-3 text-sm text-muted-foreground">
                <Clock className="w-5 h-5" />
                Crystal is still building this profile - search again in a few seconds.
            </div>
        );
    }

    const profile = result.profile;
    if (!profile) return null;

    const discType = profile.personalities?.disc_type || profile.personalities?.discType;

    return (
        <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-6 mt-4 space-y-4">
            <div className="flex items-center gap-3">
                {profile.photo_url && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={profile.photo_url} alt="" className="w-10 h-10 rounded-full object-cover" />
                )}
                <div>
                    <h3 className="text-sm font-semibold text-foreground">
                        {profile.first_name} {profile.last_name}
                    </h3>
                    {discType && <p className="text-xs text-muted-foreground">DISC type: {discType}</p>}
                </div>
            </div>

            {profile.content && (
                <div className="text-xs text-muted-foreground whitespace-pre-wrap">
                    {typeof profile.content === "string" ? profile.content : JSON.stringify(profile.content, null, 2)}
                </div>
            )}
        </div>
    );
}
