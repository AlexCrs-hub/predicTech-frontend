import { fetchUserLines } from "@/lib/api/lineApi";
import ProductionLineCard from "@/lib/components/line/ProductionLineCard";
import { ProductionLine } from "@/lib/types/ProductionLine";
import { useEffect, useState } from "react";

export default function ProductionLinesPage() {
    const [productionLines, setProductionLines] = useState<ProductionLine[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchProductionLines = async () => {
            try {
                const response = await fetchUserLines();
                if (!response.success) {
                    throw new Error("Failed to fetch production lines");
                }
                const data = response.data as ProductionLine[];
                setProductionLines(data);
            } catch (error) {
                console.log("Error fetching production lines:", error);
                setError("Failed to load production lines");
            } finally {
                setLoading(false);
            }
        };
        fetchProductionLines();
    }, []);

    if (loading) return <p>Loading...</p>;
    if (error) return <p>Error: {error}</p>;


    return (
        <div className="flex w-full justify-center items-center max-h-screen h-full pt-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-6xl">
                {productionLines.map((line) => (
                    <ProductionLineCard key={line._id} {...line} />
                ))}
            </div>
        </div>
    );
}