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
    const [encodedCohort,setEncodedCohort] = useState();
    const maxNeighbors = 5;
    const topMargin = 20;
    const bottomMargin = Math.min(height*.5,90);
    const textHeight = 10;
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
    const allVars = Object.keys(ordinalVars)
    .concat(continuousVars)
    .concat(booleanVars)
    .concat(['placeholder'])
    .concat(constants.DECISIONS)
    .concat(['placeholder2'])
    .concat(constants.OUTCOMES);
    
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
        for(const key of booleanVars.concat(constants.DECISIONS).concat(constants.OUTCOMES)){
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
        return val
    }

    function encodePatient(p,isSimulated=false){
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
        for(let key of constants.DECISIONS){
            if(isSimulated){
                let loc = constants.DECISIONS.indexOf(key);
                let decision = props.getSimulation()['decision'+(loc+1)];
                values[key] = decision;
            } else{
                let val = p[key] === undefined? 0:p[key] > .5;
                values[key] = val;
            }
        }
        for(let key of constants.OUTCOMES){
            if(isSimulated){
                let loc = constants.OUTCOMES.indexOf(key);
                let outcome = props.getSimulation()['outcomes'][loc];
                values[key] = outcome;
            } else{
                let val = p[key] === undefined? 0:p[key];
                values[key] = val;
            }
        }
        return values;
    }

    function makePanel(){
        //pass
        
        let mainPatient = encodePatient(props.patientFeatures,true);
        

        const simResults = props.simulation[props.modelOutput];
        const decision = simResults['decision'+(props.currState+1)];
        const attention = simResults['decision'+(props.currState+1)+'_attention'];

        const attentionScale = d3.scaleDiverging()
            .domain([attention.range[0], 0, attention.range[1]])
            .range(constants.divergingAttributionColors);


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

        for(let key of allVars){
            if(key.includes('placeholder')){continue}
            let val = mainPatient[key];
            val = val === undefined? 0: val;
            let x = getX(key);
            let y = getY(val,key);
            let attentionV = getAttention(key);
            let className = 'patientMarker mainPatient';
            if(constants.OUTCOMES.concat(constants.DECISIONS).indexOf(key) < 0){
                className += ' moveable'
            }
            pData.push({
                'x': x,
                'y': y,
                'name':key,
                'value': val,
                'id': -1,
                'class': className,
                'fill': attentionScale(attentionV),
                'attention': attentionV,
            })
        }

        let nPaths = [];
        let decisionName = constants.DECISIONS[props.currState];
        const mainDecisionProbability = props.getSimulation();
        //props.simulation[props.modelOutput]['decision'+(props.currState+1)];
        const mainDecision = (mainDecisionProbability > .5) + 0;

        const isCf = id => {
            let val = props.cohortData[id+''];
            return parseInt(val[decisionName] + 0) !== parseInt(mainDecision + 0)
        }
        const neighbors = props.currEmbeddings['neighbors'].filter(d=>!isCf(d)).slice(0,maxNeighbors);
        const counterfactuals = props.currEmbeddings['neighbors'].filter(d=>isCf(d)).slice(0,maxNeighbors);

        const objKeys = Object.keys(encodedCohort[0]);
        function makeTemplate(){
            let obj = {}
            for(let key of objKeys){
                obj[key] = [];
            }
            return obj
        }

        let neighborMeans = makeTemplate();
        let cfMeans = makeTemplate();
        let allMeans = makeTemplate();
        let neighborEntries = [];
        let cfEntries = [];
        for(let entry of encodedCohort){
            let isNeighbor = neighbors.indexOf(entry.id) > -1;
            let isCounterFact = counterfactuals.indexOf(entry.id) > -1;
            if(isNeighbor){
                neighborEntries.push(entry);
            } else if(isCounterFact){
                cfEntries.push(entry);
            }
        }

        

        function meanitize(entryList){
            const keys = Object.keys(entryList[0]);
            let obj = {};
            for(let key of keys){
                let vals = entryList.map(d=>d[key]);
                let sum = 0;
                for(let v of vals){
                    sum += v;
                }
                obj[key] = sum/vals.length
            }
            return obj
        }
        neighborMeans = meanitize(neighborEntries);
        cfMeans = meanitize(cfEntries);
        allMeans = meanitize(encodedCohort);


        function formatPath(entry,id,className,
            lineColor='black',
            opacity=.001,similarity=0){

            let pathPoints = [];
            let markerPoints = [];
            let decision = entry[decisionName];
            for(let key of allVars){
                if(key.includes('placeholder')){continue}
                let val = entry[key];
                let x = getX(key);
                let y = getY(val,key);
                pathPoints.push([x,y]);
                markerPoints.push({
                    'x': x,
                    'y': y,
                    'name': key,
                    'value': val,
                    'id': id,
                    'class': className,
                    'fill': lineColor,
                    'attention': 0,
                })
            }
            let path = d3.line()(pathPoints);
            let pathEntry = {
                'path': path,
                'similarity': similarity,
                'decision': decision,
                'id': id,
                'opacity': opacity,
                'stroke': lineColor,
                'data': entry,
            }
            return [pathEntry, markerPoints]
        }

        const [allPath, allDots] = formatPath(allMeans,
            'cohort avg','patientMarker meanMarker','black',.5,'');
        
        //want decision = yes to be blue
        const cfColor = mainDecision > 0? constants.noColor: constants.yesColor;
        const nColor = mainDecision > 0? constants.yesColor:constants.noColor;
        const [nPath, nDots] = formatPath(neighborMeans,
            'neighbors','patientMarker meanMarker',nColor,.5,'');
        const [cfPath, cfDots] = formatPath(cfMeans,
            'counterfactuals','patientMarker meanMarker',cfColor,.5,'');
        nPaths.push(allPath);
        nPaths.push(nPath);
        nPaths.push(cfPath);
        pData = pData.concat(allDots).concat(nDots).concat(cfDots);

        //if I bring this back do also cf entries
        // for(let nEntry of neighborEntries){
        //     let nPos = neighbors.indexOf(nEntry.id);
        //     let sim = 0;
        //     if(nPos > -1){ sim =  props.currEmbeddings['similarities'][nPos]; }
        //     nPaths.push( formatPath(nEntry,nEntry.id,'patientMarker','grey',.01,sim)[0] );
        // }
        
        var getRadius = (d)=>{
            if(d.id === -1){
                return 10;
            }
            return 7;
        }

        var getFill = (d)=>{return d.fill;}

        var getPathColor= (d)=>{ return d.stroke; }

        function getOpacity(d){
            if(d.id === -1){
                return 1;
            }
            return .7;
        }

        svg.selectAll('.patientLines').remove();
        svg.selectAll('.patientLines')
            .data(nPaths).enter()
            .append("path").attr('class','patientLines')
            .attr('d',d=>d.path)
            .attr('opacity',d=>d.opacity)
            .attr('fill','none')
            .attr('stroke-width',3)
            .attr('stroke',getPathColor)
            .on('mouseover',function(e,d){
                let string = d.id + '</br>';
                for(let [key,value] of Object.entries(d.data)){
                    if(key === 'id'){continue}
                    string += key + ': ' + value.toFixed(2) + '</br>'
                }
                tTip.html(string);
            }).on('mousemove', function(e){
                Utils.moveTTipEvent(tTip,e);
            }).on('mouseout', function(e){
                Utils.hideTTip(tTip);
            });
        
        svg.selectAll('.patientMarker').remove();
        let pCircles = svg.selectAll('.patientMarker')
            .data(pData).enter()
            .append('circle').attr('class',d=>d.class)
            .attr('cx',d=>d.x)
            .attr('cy',d=>d.y)
            .attr('r',getRadius)
            .attr('fill',getFill)
            .attr('opacity',getOpacity)
            .attr('stroke','black')
            .attr('cursor',d=> d.class.includes('moveable')? 'pointer':'')
            .attr('stroke-width',1);

        svg.selectAll('.patientMarker').raise()
        svg.selectAll('.mainPatient').raise();
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
                }else{
                    let oldVal = d.value;
                    if(Math.abs(oldVal - newVal) > .00001){
                        fQue[d.name] = newVal;
                    }
                }
                d3.select(this)
                    .attr('cy',newY)
                props.setFeatureQue(fQue);
        });

        let mP = svg.selectAll('.patientMarker');
        if(!mP.empty()){
            mP.on('mouseover',function(e,d){
                let attention = d.attention === undefined? 'NA': d.attention.toFixed(3);
                let string = d.id + '</br>'
                    + d.name + ': ' + d.value + '</br>'
                    + 'attribution: ' + attention;
                tTip.html(string);
            }).on('mousemove', function(e){
                Utils.moveTTipEvent(tTip,e);
            }).on('mouseout', function(e){
                Utils.hideTTip(tTip);
            })
            mP.filter('.moveable').call(dragHandler);
        }
    }

    useEffect(function processCohort(){
        if(props.cohortData === undefined){return}
        let patients = [];
        for(let [id,entry] of Object.entries(props.cohortData)){
            let pEntry = encodePatient(entry);
            pEntry['id'] = parseInt(id);
            patients.push(pEntry);
        }
        setEncodedCohort(patients);
    },[props.cohortData])

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
            const labels = [];
            for(const [key,scale] of Object.entries(s)){
                let x = getX(key);
                let y0 = height-bottomMargin//scale.range()[0];
                let y1 = topMargin//scale.range()[1];
                let line = d3.line()([[x,y0],[x,y1]]);
                axes.push({
                    'path': line,
                    'name': key,
                    'domain': scale.domain(),
                    'xText':x,
                    'yText': y0 + 20 + textHeight,
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
                .append('circle').attr('class','axesTick')
                .attr('cx',d=>d.x)
                .attr('cy',d=>d.y)
                .attr('r',2)
                .attr('fill','white')
                .attr('stroke','gray')
                .attr('stroke-width',2);

            svg.selectAll('.axesText').remove();
            svg.selectAll('.axesText')
                .data(axes).enter()
                .append('text').attr('class','axesText')
                .attr('font-size',textHeight)
                .attr('x',0).attr('y',0)
                .attr('transform',d=> 'translate('+d.xText+','+d.yText+')rotate(-40)')
                .attr('text-anchor','middle')
                .attr('alignment-baseline','middle')
                .text(d=>Utils.getFeatureDisplayName(d.name))
        }
    },[props.cohortData,svg]) 

    useEffect(()=>{
        if(!Utils.allValid([svg,props.patientFeatures,
            encodedCohort,
            props.currEmbeddings,
            props.simulation,
            varScales])){return}
        makePanel()
    },[props.patientFeatures,
        svg,
        props.simulation,
        props.getSimulation,
        encodedCohort,
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