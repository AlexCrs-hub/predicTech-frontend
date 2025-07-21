import { ProductionLine } from "@/lib/types/ProductionLine";
import { Link } from "react-router-dom";

export default function ProductionLineCard(props: ProductionLine) {
  return (
    <>
      <Link to={`/app/machine-list?lineId=${props._id}`} className="flex items-center">
        <div className="inline-flex items-center gap-2 p-4 border rounded hover:bg-gray-100 transition-colors">
          <span className="font-medium">{props.name}</span>
          <span className={`w-2 h-2 me-1 bg-${props.machines.length > 0 ? "green" : "red"}-500 rounded-full`}></span>
        </div>
      </Link>
    </>
  );
}