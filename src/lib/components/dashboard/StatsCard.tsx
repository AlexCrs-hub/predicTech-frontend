import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../ui/card";

export interface StatsCardProps {
  title: string;
  description: string;
  value: string;
}

export default function StatsCard({
  title,
  description,
  value,
}: StatsCardProps) {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{value}</CardContent>
    </Card>
  );
}
