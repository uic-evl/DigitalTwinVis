import React, {useState, useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";
import PCA from '../modules/PCA.js';





export default function ScatterPlotD3(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);
    const [pcaComponents,setPCAComponents] = useState([1,2]);

    function plotPCA(embeddingData,data,state){
        // console.log('pca',embeddingData)
        // console.log('pca2',data)
        const ids = new Array(Object.keys(embeddingData));
        const embedkey = 'embeddings_state'+state;
        const embeddings = Object.values(embeddingData).map(x=> x[embedkey])
        
        const pcaFit = PCA.getEigenVectors(embeddings);
        var projection = PCA.computeAdjustedData(embeddings,pcaFit[pcaComponents[0]],pcaFit[pcaComponents[1]]);
        projection = PCA.transpose(projection.formattedAdjustedData);
        console.log('pca fit',projection);
    }

    useEffect(()=>{
        plotPCA(props.cohortEmbeddings,props.cohortData,props.currState);
    },[props.cohortData,props.cohortEmbeddings,props.currState])

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}