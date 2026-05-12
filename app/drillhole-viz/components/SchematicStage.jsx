"use client";

import DepthAxisBar from "./DepthAxisBar";
import BoreholeSchematicPreview from "./BoreholeSchematicPreview";
import { computeMaxDepth } from "../utils/computeMaxDepth";
import { svgHeightForMaxDepth } from "../utils/depthScaleConfig";

const MOBILE_BASE_WIDTH = 58 + 8 + 258;
const DESKTOP_BASE_WIDTH = 90 + 12 + 980;

export function getSchematicStageMetrics({ selectedHole, compact = false }) {
	const maxDepth = computeMaxDepth({
		plannedDepth: selectedHole?.planned_depth,
		actualDepth: selectedHole?.depth,
		minDepth: 30,
		step: 10,
	});

	return {
		baseWidth: compact ? MOBILE_BASE_WIDTH : DESKTOP_BASE_WIDTH,
		height: svgHeightForMaxDepth(maxDepth),
	};
}

export default function SchematicStage({
	selectedHole,
	geoRows,
	lithById,
	componentRows,
	componentById,
	constructionRows,
	constructionById,
	annulusRows,
	annulusById,
	selectedComponentId = "",
	onSelectComponent,
	compact = false,
	scale = 1,
}) {
	if (!selectedHole) return null;

	const { baseWidth, height } = getSchematicStageMetrics({ selectedHole, compact });
	const safeScale = Number.isFinite(scale) && scale > 0 ? scale : 1;

	return (
		<div style={{ width: `${baseWidth * safeScale}px`, height: `${height * safeScale}px` }}>
			<div
				className={`${compact ? "flex gap-2" : "inline-flex gap-3"} items-start origin-top-left`}
				style={{ transform: `scale(${safeScale})` }}
			>
				<DepthAxisBar
					plannedDepth={selectedHole.planned_depth}
					actualDepth={selectedHole.depth}
					waterLevel={selectedHole.water_level_m}
					compact={compact}
				/>

				<BoreholeSchematicPreview
					holeState={selectedHole.state}
					plannedDepth={selectedHole.planned_depth}
					actualDepth={selectedHole.depth}
					waterLevel={selectedHole.water_level_m}
					geologyIntervals={geoRows}
					lithById={lithById}
					componentRows={componentRows}
					componentById={componentById}
					annulusIntervals={annulusRows}
					annulusById={annulusById}
					constructionIntervals={constructionRows}
					constructionById={constructionById}
					compact={compact}
					selectedComponentId={selectedComponentId}
					onSelectComponent={onSelectComponent}
				/>
			</div>
		</div>
	);
}