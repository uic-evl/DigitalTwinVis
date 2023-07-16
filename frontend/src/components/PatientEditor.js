import React, {useState, useEffect, useRef} from 'react';
import useSVGCanvas from './useSVGCanvas.js';
import Utils from '../modules/Utils.js';
import * as d3 from 'd3';
import * as constants from "../modules/Constants.js";



export default function PatientEditor(props){

    const d3Container = useRef(null);
    const [svg, height, width, tTip] = useSVGCanvas(d3Container);

    const [varScales,setVarScales] = useState();
    const [meanVals,setMeanVals]= useState();
    const maxNeighbors = 10;
    const topMargin = 20;
    const bottomMargin = 40;
    const xMargin = 40;
    const onlyCounterfactuals = props.onlyCounterfactuals === undefined? false:  props.onlyCounterfactuals;
    const ordinalVars = {
        'AJCC': [1,2,3,4],
        'N-category': [0,1,2,3],
        'T-category': [1,2,3,4],
        'ln_cluster': [1,2,3,4],
        'Pathological Grade': [0,1,2,3,4],
        // 'hpv': [-1,0,1]
    }
    const booleanVars = [
        'Aspiration rate Pre-therapy',
        'bilateral',
        'gender',
        'subsite_BOT','subsite_Tonsil',

    ]
    const continuousVars = [
        'age','ips_spread',
        'hpv',
        // 'contra_spread',//missing ?
        'total_dose','dose_fraction','packs_per_year']
    const allVars = Object.keys(ordinalVars).concat(continuousVars).concat(booleanVars);
    
    const xScale = d3.scaleLinear()
            .domain([0,allVars.length])
            .range([xMargin,width-xMargin]);

    function getX(key){
        let pos = allVars.indexOf(key);
        if(pos < 0){
            console.log('bad x key',key,allVars);
        }
        return xScale(pos);
    }
    function makeScales(cData){
        var scales = {};
        var means = {};
        const range = [height-bottomMargin,topMargin];
        for(const [key,entry] of Object.entries(ordinalVars)){
            scales[key] = d3.scaleLinear()
                .domain([entry[0],entry[entry.length-1]])
                .range(range);
        }
        let pVals = Object.values(cData);
        for(const key of continuousVars){
            let vals = pVals.map(d=>d[key]);
            scales[key] = d3.scaleLinear()
                .domain(d3.extent(vals))
                .range(range);
            means[key] = d3.median(vals);
        }
        for(const key of booleanVars){
            scales[key] = d3.scaleLinear()
                .domain([0,1])
                .range([range[0]-topMargin,range[1]+topMargin]);
            means[key] = 0
        }
        return [scales, means]
    }

    function encodeOrdinal(p,key,values,scale=false){
        let val = values[0];
        let isMissing=true;
        for(let i of values){
            if(p[key+'_'+i] > 0){
                val = i;
                isMissing = false;
                break;
            }
        }
        // if(isMissing){ console.log('no correct value for ',key,p,values) }
        return val
    }

    function encodePatient(p){
        let values = {}
        for(const [key,v] of Object.entries(ordinalVars)){
            values[key] = encodeOrdinal(p,key,v);
        }
        for(let key of continuousVars){
            let val = p[key] === undefined? meanVals[key]:p[key];
            values[key] = val;
        }
        for(let key of booleanVars){
            let val = p[key] === undefined? 0:p[key];
            values[key] = val;
        }
        return values;
    }

    function makePanel(){
        //pass
        
        let mainPatient = encodePatient(props.patientFeatures);
        

        const simResults = props.simulation[props.modelOutput];
        const decision = simResults['decision'+(props.currState+1)];
        const attention = simResults['decision'+(props.currState+1)+'_attention'];


        const attentionScale = d3.scaleDiverging()
            .domain([attention.range[0], 0, attention.range[1]])
            .range(['blue','white','yellow']);


        function getAttention(key){
            let aVal = 0;
            if(ordinalVars[key] !== undefined){
                let vals = ordinalVars[key];
                let keys = vals.map(i => key + '_' + i);
                for(let key of keys){
                    aVal += attention.baseline[key];
                }
            }
            else{
                aVal = attention.baseline[key];
            }
            return aVal
        }


        function getY(value,key){
            let s = varScales[key];
            return s(value);
        }

        let pData = [];

        // console.log(props.cohortData,props.currEmbeddings)
        let neighbors = props.currEmbeddings['neighbors'];
        let nPaths = [];
        let decisionName = constants.DECISIONS[props.currState];
        const mainDecisionProbability = props.simulation[props.modelOutput]['decision'+(props.currState+1)];
        const mainDecision = (mainDecisionProbability > .5) + 0;
        for(let i=0; i < neighbors.length; i += 1){
            let id = neighbors[i];
            let similarity = props.currEmbeddings['similarities'][i];
            let entry = props.cohortData[id+''];
            let decision = entry[decisionName];

            if(onlyCounterfactuals & (decision +0 === mainDecision+0)){
                continue;
            }

            entry = encodePatient(entry);
            let pathEntry = {}
            let pathPoints = []
            for(let key of allVars){
                let val = entry[key];
                let x = getX(key);
                let y = getY(val,key);
                pathPoints.push([x,y]);
                pData.push({
                    'x': x,
                    'y': y,
                    'name': key,
                    'value': val,
                    'id': id,
                    'class': 'patientMarker',
                    'fill': '',
                    'attention': 0,
                })
            }
            let path = d3.line()(pathPoints)
            nPaths.push({
                'path': path,
                'similarity': similarity,
                'decision': decision,
                'id': id,
            })
            if(nPaths.length > maxNeighbors){
                break
            }
            // console.log(encodePatient(entry),entry);
        }

        for(let key of allVars){
            let val = mainPatient[key];
            val = val === undefined? 0: val;
            let x = getX(key);
            let y = getY(val,key);
            let attentionV = getAttention(key);
            pData.push({
                'x': x,
                'y': y,
                'name':key,
                'value': val,
                'id': -1,
                'class': 'patientMarker mainPatient',
                'fill': attentionScale(attentionV),
                'attention': attentionV,
            })
        }

        var getRadius = (d)=>{
            if(d.id === -1){
                return 10;
            }
            return 1;
        }

        var getFill = (d)=>{
            if(d.id === -1){
                return d.fill;
            }
            return 'gray';
        }

        var getPathColor= (d)=>{
            return d.decision + 0 === mainDecision + 0? 'blue': 'red';
        }

        function getOpacity(d){
            if(d.id === -1){
                return 1;
            }
            return .5;
        }

        svg.selectAll('.patientLines').remove();
        svg.selectAll('.patientLines')
            .data(nPaths).enter()
            .append("path").attr('class','patientLines')
            .attr('d',d=>d.path)
            .attr('opacity',1/Math.sqrt(maxNeighbors/2))
            .attr('fill','none')
            .attr('stroke-width',3)
            .attr('stroke',getPathColor);
        
            
        svg.selectAll('.patientMarker').remove();
        let pCircles = svg.selectAll('.patientMarker')
            .data(pData).enter()
            .append('circle').attr('class','patientMarker')//d=>d.className)
            .attr('cx',d=>d.x)
            .attr('cy',d=>d.y)
            .attr('r',getRadius)
            .attr('fill',getFill)
            .attr('opacity',getOpacity)
            .attr('stroke','black')
            .attr('stroke-width',1);

        svg.selectAll('.patientMarker').raise()
        updateSliderCallbacks();
         
    }

    function updateSliderCallbacks(){
        var dragHandler = d3.drag()
            .on('drag',function(e,d){
                let scale = varScales[d.name];
                const py = e.y;
                let newY = Math.min(Math.max(topMargin,py),height-bottomMargin);
                let newVal = scale.invert(newY);
                let duration = 1;
                if(booleanVars.indexOf(d.name) > -1){
                    newVal = newVal > .5;
                    newY = scale(newVal);
                    duration = 200;
                } else if(ordinalVars[d.name] !== undefined){
                    newVal = Math.round(newVal);
                    duration = 100;
                }
                d3.select(this)
                    .transition()
                    .duration(duration)
                    .attr('cy',newY);

            }).on('end',function(e,d){
                let scale = varScales[d.name];
                let py  = e.y;
                let newY = Math.min(Math.max(topMargin,py),height-bottomMargin);
                let newVal = scale.invert(newY);
                if(booleanVars.indexOf(d.name) > -1){
                    newVal = newVal > .5;
                    newY = scale(newVal);
                } else if(ordinalVars[d.name] !== undefined | d.name === 'hpv'){
                    newVal = Math.round(newVal);
                    newY = scale(newVal);
                }
                let fQue = Object.assign({},props.featureQue);
                if(ordinalVars[d.name] !== undefined){
                    for(let val of ordinalVars[d.name]){
                        fQue[d.name+'_'+val] = (val == newVal) + 0;
                    }
                    // console.log('fque ordinal',fQue)
                }else{
                    let oldVal = d.value;
                    if(Math.abs(oldVal - newVal) > .00001){
                        fQue[d.name] = newVal;
                        // console.log('fque',fQue);
                    }
                }
                d3.select(this)
                    .attr('cy',newY)
                // props.updatePatient(fQue);
                props.setFeatureQue(fQue);
        });

        let mP = svg.selectAll('.patientMarker');
        if(!mP.empty()){
            mP.on('mouseover',function(e,d){
                let string = d.id + '</br>'
                    + d.name + ': ' + d.value + '</br>'
                    + 'attribution: ' + d.attention.toFixed(3);
                tTip.html(string);
            }).on('mousemove', function(e){
                Utils.moveTTipEvent(tTip,e);
            }).on('mouseout', function(e){
                Utils.hideTTip(tTip);
            }).call(dragHandler);
        }
    }

    useEffect(()=>{
        if(svg === undefined){ return;}
        if(props.featureQue === undefined | Object.keys(props.featureQue).length < 1){
            let points = svg.selectAll('.patientMarker');
            if(!points.empty()){
                points.transition().duration(200).attr('cy',d=>d.y);
            }
        }
            
    },[props.featureQue])

    useEffect(()=>{
        if(props.cohortData !== undefined & svg !== undefined){
            let [s,means] = makeScales(props.cohortData);
            setVarScales(s);
            setMeanVals(means);
            
            const axes = [];
            const markers = [];
            for(const [key,scale] of Object.entries(s)){
                let x = getX(key);
                let y0 = height-bottomMargin//scale.range()[0];
                let y1 = topMargin//scale.range()[1];
                let line = d3.line()([[x,y0],[x,y1]]);
                axes.push({
                    'path': line,
                    'name': key,
                    'domain': scale.domain(),
                })
                for(let y of [topMargin,height-bottomMargin]){
                    markers.push({
                        'x': x,
                        'y': y,
                        'name': key,
                    })
                }
            }
            svg.selectAll('.axes').remove();
            svg.selectAll('.axes')
                .data(axes).enter()
                .append('path')
                .attr('class','axes')
                .attr('d',d=>d.path)
                .attr('stroke-width',3)
                .attr('stroke','black')
                .attr('opacity',.01);

            svg.selectAll('.axesTick').remove();
            svg.selectAll('.axesTick')
                .data(markers).enter()
                .append('circle').attr('class','.axesTick')
                .attr('cx',d=>d.x)
                .attr('cy',d=>d.y)
                .attr('r',2)
                .attr('fill','white')
                .attr('stroke','gray')
                .attr('stroke-width',2)
        }
    },[props.cohortData,svg]) 

    useEffect(()=>{
        if(!Utils.allValid([svg,props.patientFeatures,
            props.cohortData,props.currEmbeddings,
            props.simulation,
            varScales])){return}
        makePanel()
    },[props.patientFeatures,
        props.cohortData,svg,
        props.simulation,
        props.currState,props.modelOutput,
        props.currEmbeddings,varScales])

    useEffect(()=>{
        if(Utils.allValid([svg,varScales])){
            updateSliderCallbacks();
        }
    },[props.featureQue,svg,varScales]);

    return (
        <div
            className={"d3-component"}
            style={{'height':'95%','width':'95%'}}
            ref={d3Container}
        ></div>
    );
}