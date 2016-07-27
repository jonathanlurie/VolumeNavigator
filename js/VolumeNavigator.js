/*
    outerBoxOptions = {
        xSize: number,
        ySize: number,
        zSize: number
    }

    innerBoxOptions = {
        xSize: number,
        ySize: number,
        zSize: number,
        xOrigin: number,
        yOrigin: number,
        zOrigin: number
    }

    divID: string, ID of the div to display the VolumeNavigator

*/
var VolumeNavigator = function(outerBoxOptions, innerBoxOptions, divID){
    this.outerBoxSize = outerBoxOptions;
    this.innerBoxSize = innerBoxOptions;
    this.domContainer = document.getElementById(divID);

    this.boxDiagonal = Math.sqrt(this.outerBoxSize.xSize * this.outerBoxSize.xSize +
        this.outerBoxSize.ySize * this.outerBoxSize.ySize +
        this.outerBoxSize.zSize * this.outerBoxSize.zSize);

    this.sceneOptions = {
        width: this.domContainer.clientWidth,
        height: this.domContainer.clientHeight,
        viewAngle: 45,
        near: 0.1,
        far: this.boxDiagonal * 20,

    };

    // plane equation as (ax + by + cz + d = 0)
    this.planeEquation = {
        a: 0,
        b: 0,
        c: 0,
        d: 0
    }

    // array of intersection points between the plane and the volume
    this.planePolygon = null;

    // array triangles
    this.polygonTriangles = null;

    // array of object (material, geometry, mesh).
    // Used to symbolize the intersections between the plane and the volume
    this.intersectionSpheres = [];

    // declaring it in advance allow to test its instanciation
    // contains the mesh, geometry and material of the plane
    this.plane = null;
    this.arrowHelper = null;

    // callback when a slider is moved (still mouse down)
    this.onChangeCallback = null;

    // callback when a slider has finished to slide (mouse up)
    this.onFinishChangeCallback = null;

    // Array containg each edge (12) equation in space
    this.cubeEdges = this.getEdgesEquations();

    this.vectorTools = new VectorTools();

    // initialize THREE js elements necessary to create and render a scene
    this.init();

    // build the box context
    this.buildInnerBox();
    this.buildOuterBox();
    this.buildPlane();
    this.initPolygonTriangles();
    this.setupLighting();

    // initialize the UI (dat.gui)
    this.initGui();

    // just toinitialize in order to update dat.gui field
    this.update();

    // animate and update
    this.animate();
}


/*

*/
VolumeNavigator.prototype.setOnChangeCallback = function(cb){
  this.onChangeCallback = cb;
}


/*

*/
VolumeNavigator.prototype.setOnFinishChangeCallback = function(cb){
  this.onFinishChangeCallback = cb;
}

/*
    Create and initialize all the necessary to build a THREE scene
*/
VolumeNavigator.prototype.init = function(){
    // THREE.JS rendered
    this.renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true
    });

    // THREE.JS camera
    this.camera = new THREE.PerspectiveCamera(
        this.sceneOptions.viewAngle,
        this.sceneOptions.width / this.sceneOptions.height,
        this.sceneOptions.near,
        this.sceneOptions.far
    );

    // THREE.JS orbit controls
    this.controls = new THREE.OrbitControls( this.camera, this.renderer.domElement );
    this.controls.target.fromArray([this.outerBoxSize.xSize / 2, this.outerBoxSize.ySize / 2, this.outerBoxSize.zSize / 2])

    // THREE.JS scene
    this.scene = new THREE.Scene();


    // add the camera to the scene
    this.scene.add(this.camera);

    // the camera starts at 0,0,0
    // so pull it back, in a more comfortable position
    this.camera.position.z = this.boxDiagonal * 2;
    this.camera.position.y = this.boxDiagonal * 1.5;
    this.camera.position.x = -this.boxDiagonal;

    // start the renderer
    this.renderer.setSize(this.sceneOptions.width, this.sceneOptions.height);

    // attach the render-supplied DOM element
    this.domContainer.appendChild(this.renderer.domElement);

    // add axis
    var axisHelper = new THREE.AxisHelper( this.boxDiagonal / 4 );
    this.scene.add( axisHelper );
}



/*
    Build the inner box (aka. brain within minc) ans displays it on the scene
*/
VolumeNavigator.prototype.buildInnerBox = function(){
    this.innerBox = {};

    // material
    /*
    this.innerBox.material = new THREE.MeshLambertMaterial( {

        transparent: true,
        opacity: 1,
        color: 0x7E2FB4,
        emissive: 0x000000,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
        wireframe: true
    });
    */

    this.innerBox.material = new THREE.MeshBasicMaterial({
        color: 0x7E2FB4,
        wireframe: true,

    });

    // geometry
    this.innerBox.geometry = new THREE.CubeGeometry(
        this.innerBoxSize.xSize,
        this.innerBoxSize.ySize,
        this.innerBoxSize.zSize
    );

    // the corner of the box is at the origin
    this.innerBox.geometry.translate(
        this.innerBoxSize.xSize / 2 + this.innerBoxSize.xOrigin,
        this.innerBoxSize.ySize / 2 + this.innerBoxSize.yOrigin,
        this.innerBoxSize.zSize / 2 + this.innerBoxSize.zOrigin
    );

    var innerBoxMesh = new THREE.Mesh( this.innerBox.geometry, this.innerBox.material )

    // add the inner box to scene
    //this.scene.add( innerBoxMesh );

    // adding the wireframe provide better understanding of the scene
    var helper = new THREE.EdgesHelper( innerBoxMesh, 0x7E2FB4 );
    this.scene.add( helper );

}


/*
    Build the inner box (aka. brain within minc) ans displays it on the scene
*/
VolumeNavigator.prototype.buildOuterBox = function(){

    this.outerBox = {};

    // material
    this.outerBox.material = new THREE.MeshLambertMaterial( {
        transparent: true,
        opacity: 0.8,
        color: 0xc489ed,
        emissive: 0x000000,
        depthWrite: true,
        depthTest: true,
        side: THREE.BackSide


    });

    // geometry
    this.outerBox.geometry = new THREE.CubeGeometry(
        this.outerBoxSize.xSize,
        this.outerBoxSize.ySize,
        this.outerBoxSize.zSize
    );


    // the corner of the box is at the origin
    this.outerBox.geometry.translate(
        this.outerBoxSize.xSize / 2,
        this.outerBoxSize.ySize / 2,
        this.outerBoxSize.zSize /2
    );

    // add the outer box to the scene
    this.scene.add( new THREE.Mesh( this.outerBox.geometry, this.outerBox.material ) );

}


/*
    Calls buildPlaneFromNormalAndPoint with default settings
*/
VolumeNavigator.prototype.buildPlane = function(){

  this.buildPlaneFromNormalAndPoint(
    [0, 0, 1],
    [
      this.outerBoxSize.xSize / 2,
      this.outerBoxSize.ySize / 2,
      this.outerBoxSize.zSize / 2
    ]

  );
}


/*
  rebuild a plane from scratch. May or may not overload the existing one
*/
VolumeNavigator.prototype.buildPlaneFromNormalAndPoint = function(vector, point){

  var p1 = new THREE.Vector3(point[0], point[1], point[2]);
  var n = new THREE.Vector3(vector[0], vector[1], vector[2]).normalize();
  var d = (-1) * (n.x * p1.x + n.y * p1.y + n.z * p1.z );

  // find another point on the plane...
  // The next 3 cases are for when a plane is (at least in 1D)
  // aligned with the referential
  var p2 = null;

  // case 1
  if(n.z != 0){
    var x2 = p1.x + 1;
    var y2 = p1.y;
    var z2 = (-1) * ( (n.x * x2 + n.y * y2 + d) / n.z );
    p2 = new THREE.Vector3(x2, y2, z2);
  }

  // case 2
  if(n.y != 0 && !p2){
    var x2 = p1.x + 1;
    var z2 = p1.z;
    var y2 = (-1) * ( (n.x * x2 + n.z * z2 + d) / n.y );
    p2 = new THREE.Vector3(x2, y2, z2);
  }

  // case 3
  if(n.x != 0 && !p2){
    var y2 = p1.y + 1;
    var z2 = p1.z;
    var x2 =  (-1) * ( (n.y * y2 + n.z * z2 + d) / n.x );
    p2 = new THREE.Vector3(x2, y2, z2);
  }

  // unit vectors:
  var u = new THREE.Vector3().subVectors(p2, p1).normalize();
  var v = new THREE.Vector3().crossVectors(u, n).normalize();

  // remove the plane from the scene to RE-build it
  if(this.plane){
    console.log("rebuild the plane");
      this.scene.remove( this.plane.mesh );
  }

  if(this.guiValue){
    this.guiValue.current.xTrans = point[0];
    this.guiValue.current.yTrans = point[1];
    this.guiValue.current.zTrans = point[2];

    this.guiValue.previous.xTrans = point[0];
    this.guiValue.previous.yTrans = point[1];
    this.guiValue.previous.zTrans = point[2];
  }


  // the square representing the plan has a side measuring this.boxDiagonal
  this.plane = {};


  // material
  this.plane.material = new THREE.MeshLambertMaterial( {
      transparent: true,
      opacity: 0.05,
      color: 0xFF0000,
      emissive: 0x000000,    // darkest color
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
  } );

  this.plane.geometry = new THREE.Geometry();

  var planeSideSize = 0.01; //this.boxDiagonal;
  // vertice declaration
  // 0
  this.plane.geometry.vertices.push(
    new THREE.Vector3(
      -(planeSideSize/2) * u.x - (planeSideSize/2) * v.x,
      -(planeSideSize/2) * u.y - (planeSideSize/2) * v.y,
      -(planeSideSize/2) * u.z - (planeSideSize/2) * v.z
    ));

  // 1
  this.plane.geometry.vertices.push(
    new THREE.Vector3(
      (planeSideSize/2) * u.x - (planeSideSize/2) * v.x,
      (planeSideSize/2) * u.y - (planeSideSize/2) * v.y,
      (planeSideSize/2) * u.z - (planeSideSize/2) * v.z
    ));

  // 2
  this.plane.geometry.vertices.push(
    new THREE.Vector3(
      (planeSideSize/2) * u.x + (planeSideSize/2) * v.x,
      (planeSideSize/2) * u.y + (planeSideSize/2) * v.y,
      (planeSideSize/2) * u.z + (planeSideSize/2) * v.z
    ));

  // 3
  this.plane.geometry.vertices.push(
    new THREE.Vector3(
      -(planeSideSize/2) * u.x + (planeSideSize/2) * v.x,
      -(planeSideSize/2) * u.y + (planeSideSize/2) * v.y,
      -(planeSideSize/2) * u.z + (planeSideSize/2) * v.z
    ));

  // creation of triangles from existing vertice (using their index)
  this.plane.geometry.faces.push( new THREE.Face3( 0, 1, 2 ) );
  this.plane.geometry.faces.push( new THREE.Face3( 3, 0, 2 ) );

  this.plane.geometry.translate(
      this.outerBoxSize.xSize / 2,
      this.outerBoxSize.ySize / 2,
      this.outerBoxSize.zSize / 2
  );

  this.plane.geometry.computeFaceNormals();
  this.plane.mesh = new THREE.Mesh( this.plane.geometry, this.plane.material );
  this.scene.add( this.plane.mesh );
}


/*
    seting up both lights, ambient and point
*/
VolumeNavigator.prototype.setupLighting = function(){

    var ambientLight = new THREE.AmbientLight( 0xFFFFFF );
    this.scene.add( ambientLight );


    // create a point light
    var pointLight = new THREE.PointLight(0xFFFFFF);

    // set its position
    pointLight.position.x = this.boxDiagonal * 10;
    pointLight.position.y = this.boxDiagonal * 10;
    pointLight.position.z = this.boxDiagonal * 10;

    // add to the scene
    this.scene.add(pointLight);
}


/*
    Render the scene
*/
VolumeNavigator.prototype.render = function(){
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
}


/*
    animate the scene
*/
VolumeNavigator.prototype.animate = function(){
    requestAnimationFrame(this.animate.bind(this));
    this.render();
}


/*
    Adds the settings available in dat.gui
*/
VolumeNavigator.prototype.initGui = function(){
    this.gui = new dat.GUI({ width: 400 });

    this.guiValue = {};

    this.guiValue.current = {
        xTrans: 0,
        yTrans: 0,
        zTrans: 0,
        xRot  : 0,
        yRot  : 0,
        zRot  : 0
    };

    // a backup so that we can make dif
    this.guiValue.previous = {
        xTrans: 0,
        yTrans: 0,
        zTrans: 0,
        xRot  : 0,
        yRot  : 0,
        zRot  : 0
    };

    this.guiValue.literalPlaneEquation = {
        literal: "hello"
    }

    this.guiValue.normalVector = {
        literal: "hello"
    }

    this.guiValue.point = {
        literal: "hello"
    }

    // used later but better to declare here to avoid resetting
    this.guiValue.customButton = {};
    this.guiValue.customList = {};

    var that = this;

    var planeInfoFolder = this.gui.addFolder('Plane information');
    planeInfoFolder.add(this.guiValue.literalPlaneEquation, 'literal').name("Plane equation").listen();
    planeInfoFolder.add(this.guiValue.normalVector, 'literal').name("Normal vector").listen();
    planeInfoFolder.add(this.guiValue.point, 'literal').name("Point").listen();

    // TRANSLATION
    var planeTransFolder = this.gui.addFolder('Plane translation');
    planeTransFolder.add(this.guiValue.current, "xTrans", -this.boxDiagonal*1., this.boxDiagonal*1., 1).name("x").listen()
        .onChange(function(value) {
            that.plane.geometry.translate(
                that.guiValue.previous.xTrans - that.guiValue.current.xTrans,
                that.guiValue.previous.yTrans - that.guiValue.current.yTrans,
                that.guiValue.previous.zTrans - that.guiValue.current.zTrans
            );

            that.guiValue.previous.xTrans = value;

            that.update();

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }

        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });

    planeTransFolder.add(this.guiValue.current, "yTrans", -this.boxDiagonal*1., this.boxDiagonal*1., 1).name("y").listen()
        .onChange(function(value) {
            that.plane.geometry.translate(
                that.guiValue.previous.xTrans - that.guiValue.current.xTrans,
                that.guiValue.previous.yTrans - that.guiValue.current.yTrans,
                that.guiValue.previous.zTrans - that.guiValue.current.zTrans
            );

            that.guiValue.previous.yTrans = value;

            that.update();

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });

    planeTransFolder.add(this.guiValue.current, "zTrans", -this.boxDiagonal*1., this.boxDiagonal*1., 1).name("z").listen()
        .onChange(function(value) {
            that.plane.geometry.translate(
                that.guiValue.previous.xTrans - that.guiValue.current.xTrans,
                that.guiValue.previous.yTrans - that.guiValue.current.yTrans,
                that.guiValue.previous.zTrans - that.guiValue.current.zTrans
            );

            that.guiValue.previous.zTrans = value;

            that.update();

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });


    // ROTATION
    var planeRotationFolder = this.gui.addFolder('Plane rotation');
    planeRotationFolder.add(this.guiValue.current, "xRot", -180, 180).name("x")
        .onChange(function(value) {
            dif = that.guiValue.previous.xRot - value;
            that.rotatePlaneDegree(dif, 0, 0);
            that.guiValue.previous.xRot = value;

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });

    planeRotationFolder.add(this.guiValue.current, "yRot", -180, 180, 1).name("y")
        .onChange(function(value) {
            dif = that.guiValue.previous.yRot - value;
            that.rotatePlaneDegree(0, dif, 0);
            that.guiValue.previous.yRot = value;

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });

    planeRotationFolder.add(this.guiValue.current, "zRot", -180, 180, 1).name("z")
        .onChange(function(value) {
            dif = that.guiValue.previous.zRot - value;
            that.rotatePlaneDegree(0, 0, dif);
            that.guiValue.previous.zRot = value;

            // calling the callback if defined
            if(that.onChangeCallback){
              that.onChangeCallback();
            }
        })
        .onFinishChange(function(value) {
          // calling the callback if defined
          if(that.onFinishChangeCallback){
            that.onFinishChangeCallback();
          }
        });



}


/*
  Add a button with its callback
*/
VolumeNavigator.prototype.buildGuiButton = function(name, callback){
  this.guiValue.customButton["name"] = name;
  this.guiValue.customButton["callback"] = callback;

  this.gui.add(this.guiValue.customButton, 'callback').name(this.guiValue.customButton.name);
}


/*
  Build the list of choice with a callback.
  args:
    listName: string - the name that will be displayed
    list: Array or Object (map) - the choices
    callback: function - function to call when a choice is done. It takes the value as argument.
*/
VolumeNavigator.prototype.buildGuiList = function(listName, list, callback){


  if(! (typeof this.guiValue.customList["controller"] === "undefined") ){
    // remove the current elem
    this.gui.remove(this.guiValue.customList["controller"]);
    this.guiValue.customList = {};
    // Works because the list is the last element of gui
    //this.gui.__controllers[this.gui.__controllers.length - 1].remove();

  }

  this.guiValue.customList["list"] = list;
  this.guiValue.customList["listName"] = listName;
  this.guiValue.customList["callback"] = callback;

  this.guiValue.customList["controller"] = this.gui.add(
    this.guiValue.customList,
    "listName",
    this.guiValue.customList["list"]
  )
  .name(this.guiValue.customList["listName"]) // necessay, I think there is a bug in using the name
  .onFinishChange(callback);

}


/*
  called when a slider is moved.
  Update few things: equation, normal, point, hitpoint
*/
VolumeNavigator.prototype.update = function(){
  this.updatePlaneEquation();

  // compute the intersection points
  this.computeCubePlaneHitPoints();

  this._orderPolygonPoints();

  this.updatePolygonTriangles();

  // sphere to display at each plane/volume intersection
  this.updateHitPointSpheres();



}


/*
    Updates the plane equation, based on three points of the plane
*/
VolumeNavigator.prototype.updatePlaneEquation = function(){

  var n = this.getPlaneNormal();
  var p = this.getPlanePoint();


  var eq = new THREE.Vector4(
      n[0],
      n[1],
      n[2],
      (-1) * (n[0]*p[0] + n[1]*p[1] + n[2]*p[2])
  );

  //eq.normalize();

  var roundFactor = 10000;

  this.planeEquation.a = Math.round(eq.x * roundFactor) / roundFactor;
  this.planeEquation.b = Math.round(eq.y * roundFactor) / roundFactor;
  this.planeEquation.c = Math.round(eq.z * roundFactor) / roundFactor;
  this.planeEquation.d = Math.round(eq.w * roundFactor) / roundFactor;

  // create a nice-to-display equation
  this.guiValue.literalPlaneEquation.literal =
      this.planeEquation.a + "x + " +
      this.planeEquation.b + "y + " +
      this.planeEquation.c + "z + " +
      this.planeEquation.d + " = 0";


  // Display/refresh the plane normal and the point

  var normalRounded = {
    x: Math.round(n[0] * roundFactor) / roundFactor,
    y: Math.round(n[1] * roundFactor) / roundFactor,
    z: Math.round(n[2] * roundFactor) / roundFactor
  };


  var pointRounded = {
    x: Math.round(p[0] * roundFactor) / roundFactor,
    y: Math.round(p[1] * roundFactor) / roundFactor,
    z: Math.round(p[2] * roundFactor) / roundFactor
  };

  this.guiValue.normalVector.literal = "(" + normalRounded.x + " ; " + normalRounded.y + " ; " + normalRounded.z + ")";

  this.guiValue.point.literal = "(" + pointRounded.x + " ; " + pointRounded.y + " ; " + pointRounded.z + ")";


  //this.getRotationMatrixSliceToZX();
}


/*
    return the plane equation as (ax + by + cz + d = 0).
*/
VolumeNavigator.prototype.getPlaneEquation = function(){
    return this.planeEquation;
}


/*
  get the normal vector of the plane as a array [x, y, z]
*/
VolumeNavigator.prototype.getPlaneNormal = function(){
  var normal = new THREE.Vector3();
  normal.copy(this.plane.geometry.faces[0].normal);
  normal.normalize();

  return [normal.x, normal.y, normal.z];
}


/*
  Get the center point of the plane as an array [x, y, z]
*/
VolumeNavigator.prototype.getPlanePoint = function(){
  return [
      (this.plane.geometry.vertices[0].x +
      this.plane.geometry.vertices[1].x +
      this.plane.geometry.vertices[2].x +
      this.plane.geometry.vertices[3].x) / 4. ,

      (this.plane.geometry.vertices[0].y +
      this.plane.geometry.vertices[1].y +
      this.plane.geometry.vertices[2].y +
      this.plane.geometry.vertices[3].y) / 4. ,

      (this.plane.geometry.vertices[0].z +
      this.plane.geometry.vertices[1].z +
      this.plane.geometry.vertices[2].z +
      this.plane.geometry.vertices[3].z)  / 4.
  ];
}


/*
  Define the center point of the red square (symbolizes a point of the plane).
  Along with setPlaneNormal(), it defines the plane equation.
  Args:
    p: Array [x, y, z] - the absolute position to reach
*/
VolumeNavigator.prototype.setPlanePoint = function(p){
  var currentPlanePoint = this.getPlanePoint();

  // Translate the plane to origin and then to p
  this.plane.geometry.translate(
      -currentPlanePoint[0] + p[0],
      -currentPlanePoint[1] + p[1],
      -currentPlanePoint[2] + p[2]
  );


  this.guiValue.current.xTrans = p[0];
  this.guiValue.current.yTrans = p[1];
  this.guiValue.current.zTrans = p[2];

  this.guiValue.previous.xTrans = p[0];
  this.guiValue.previous.yTrans = p[1];
  this.guiValue.previous.zTrans = p[2];




  // updating equation and its display on dat.gui
  this.update();

}


/*
  Change the orientation of the plane so that its normal vector is v.
  The center of rotation is the center of the red square that represents the plane
  (not the origin)
  arg:
    vector: Array [x, y, z] - a normal vector (normalized or not)
*/
VolumeNavigator.prototype.setPlaneNormal = function(vector){



  var toLookAt = new THREE.Vector3(vector[0], vector[1], vector[2]);

  var currentCenter = {
     x: this.plane.geometry.boundingSphere.center.x,
     y: this.plane.geometry.boundingSphere.center.y,
     z: this.plane.geometry.boundingSphere.center.z
  }


  this.plane.geometry.translate(
     -currentCenter.x,
     -currentCenter.y,
     -currentCenter.z
  );

  this.plane.geometry.lookAt(toLookAt);

  console.log("normal from setPlaneNormal");
  console.log(this.plane.geometry.faces[0].normal);

  this.plane.geometry.translate(
     currentCenter.x,
     currentCenter.y,
     currentCenter.z
  );

  this.update();


  /*
  var xAxis =  new THREE.Vector3(1, 0, 0);
  var yAxis =  new THREE.Vector3(0, 1, 0);
  var zAxis =  new THREE.Vector3(0, 0, 1);

  // the angle between the current normal to x, y and z axis
  var angleNormal2xAxis = this.plane.geometry.faces[0].normal.angleTo(xAxis);
  var angleNormal2yAxis = this.plane.geometry.faces[0].normal.angleTo(yAxis);
  var angleNormal2zAxis = this.plane.geometry.faces[0].normal.angleTo(zAxis);


  var futureNormal = new THREE.Vector3(vector[0], vector[1], vector[2]);

  // the angle between the current normal to x, y and z axis
  var angleFutureNormal2xAxis = futureNormal.angleTo(xAxis);
  var angleFutureNormal2yAxis = futureNormal.angleTo(yAxis);
  var angleFutureNormal2zAxis = futureNormal.angleTo(zAxis);

  console.log("angles: " + angleFutureNormal2xAxis*180/Math.PI + " " + angleFutureNormal2yAxis*180/Math.PI + " " + angleFutureNormal2zAxis*180/Math.PI);

  this.rotatePlaneRadian(
    angleFutureNormal2xAxis - angleNormal2xAxis,0, 0) ;

  this.rotatePlaneRadian(0, angleFutureNormal2yAxis - angleNormal2yAxis, 0);

  this.rotatePlaneRadian(0, 0, angleFutureNormal2zAxis - angleNormal2zAxis);

  console.log("actualNormal:");
  console.log(this.plane.geometry.faces[0].normal);
  */
}




/*
  Rotate the plane (red square) using the center of the square as the center of rotation
  (and not the origin as it would do by default).
  args ax, ay and az are in degrees and can be 0.
  Note: the plane equation is updated in the end.
*/
VolumeNavigator.prototype.rotatePlaneDegree = function(ax, ay, az){

  var radx = ax * Math.PI / 180.
  var rady = ay * Math.PI / 180.
  var radz = az * Math.PI / 180.

  this.rotatePlaneRadian(radx, rady, radz);

}


/*
  Rotate the plane (red square) using the center of the square as the center of rotation
  (and not the origin as it would do by default).
  args ax, ay and az are in radians and can be 0.
  Note: the plane equation is updated in the end.
*/
VolumeNavigator.prototype.rotatePlaneRadian = function(ax, ay, az){
  var currentCenter = {
      x: this.plane.geometry.boundingSphere.center.x,
      y: this.plane.geometry.boundingSphere.center.y,
      z: this.plane.geometry.boundingSphere.center.z
  }

  this.plane.geometry.translate(
      -currentCenter.x,
      -currentCenter.y,
      -currentCenter.z
  );

  this.plane.geometry.rotateX(ax);
  this.plane.geometry.rotateY(ay);
  this.plane.geometry.rotateZ(az);

  this.plane.geometry.translate(
      currentCenter.x,
      currentCenter.y,
      currentCenter.z
  );

  this.update();
}


/*
  TO REMOVE
  This method compute the rotation matrix between the
  plane ZX and the oblique sclice.
*/
VolumeNavigator.prototype.getRotationMatrixSliceToZX = function(ax, ay, az){
  var n_zx = [0, 1, 0];
  var n_slice = this.getPlaneNormal();

  // cross product gives the normal to n_zx and n_slice and helps giving the sine.
  // In this matter, the normal vector is also the axis of rotation between n_zx and n_slice
  var u = this.vectorTool.crossProduct(n_zx, n_slice );
  var sinTheta = this.vectorTool.getNorm(u);
  var cosTheta = this.vectorTool.dotProduct(n_zx, n_slice);

  // we need u to be normalize to use it in the rotation matrix
  var uNorm = this.vectorTool.normalize(u);
  console.log("--------------------");
  console.log(uNorm);
  //console.log("sine: " + sinTheta);

  console.log(Math.acos(cosTheta)/ Math.PI * 180);


  //console.log("cosine: " + cosTheta);

  var rotationMatrix = [
    [cosTheta + uNorm[0]*uNorm[0]*(1-cosTheta)  , uNorm[0]*uNorm[1]*(1-cosTheta) - uNorm[2]*sinTheta, uNorm[0]*uNorm[2]*(1-cosTheta) + uNorm[1]*sinTheta],
    [uNorm[1]*uNorm[0]*(1-cosTheta) + uNorm[2]*sinTheta , cosTheta + uNorm[1]*uNorm[1]*(1-cosTheta), uNorm[1]*uNorm[2]*(1-cosTheta) - uNorm[0]*sinTheta],
    [uNorm[2]*uNorm[0]*(1-cosTheta) - uNorm[2]*sinTheta , uNorm[2]*uNorm[1]*(1-cosTheta) + uNorm[0]*sinTheta, cosTheta + uNorm[2]*uNorm[2]*(1-cosTheta)]
  ]

  var point = [50, 50, 50];
  var newPoint = this.vectorTool.rotate(point, rotationMatrix)
  console.log(newPoint);

  /*
  if(this.ArrowHelper){
    this.scene.remove( this.arrowHelper );
  }

  var dir = new THREE.Vector3( 1, 0, 0 );
  var origin = new THREE.Vector3( newPoint[0], newPoint[1], newPoint[2] );
  var length = 10;
  var hex = 0x000000;

  this.arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );
  this.scene.add( this.arrowHelper );
  */

  //console.log(rotationMatrix);

}




/*
  Build the edge equations (12 of them). Helpfull when dealing with hit points.
  (Dont call it at every refresh, they dont change!)
*/
VolumeNavigator.prototype.getEdgesEquations = function(){
  var xLength = this.outerBoxSize.xSize;
  var yLength = this.outerBoxSize.ySize;
  var zLength = this.outerBoxSize.zSize;


  var edgeData = [];

  // 0
  //vector:
  var edge0Vect = [xLength, 0, 0];
  var edge0Point = [0, 0, 0];

  // 1
  // vector:
  var edge1Vect = [0, yLength, 0];
  var edge1Point = [0, 0, 0];

  // 2
  // vector:
  var edge2Vect = [0, 0, zLength];
  var edge2Point = [0, 0, 0];

  // 3
  // vector:
  var edge3Vect = [0, 0, zLength];
  var edge3Point = [xLength, 0, 0];

  // 4
  // vector:
  var edge4Vect = [xLength, 0, 0];
  var edge4Point = [0, 0, zLength];

  // 5
  // vector:
  var edge5Vect = [xLength, 0, 0];
  var edge5Point = [0, yLength, 0];

  // 6
  // vector:
  var edge6Vect = [0, 0, zLength];
  var edge6Point = [0, yLength, 0];

  // 7
  // vector:
  var edge7Vect = [0, 0, zLength];
  var edge7Point = [xLength, yLength, 0];

  // 8
  // vector:
  var edge8Vect = [xLength, 0, 0];
  var edge8Point = [0, yLength, zLength];

  // 9
  // vector:
  var edge9Vect = [0, yLength, 0];
  var edge9Point = [0, 0, zLength];

  // 10
  // vector:
  var edge10Vect = [0, yLength, 0];
  var edge10Point = [xLength, 0, 0];

  // 11
  // vector:
  var edge11Vect = [0, yLength, 0];
  var edge11Point = [xLength, 0, zLength];

  edgeData.push( [edge0Vect, edge0Point] );
  edgeData.push( [edge1Vect, edge1Point] );
  edgeData.push( [edge2Vect, edge2Point] );
  edgeData.push( [edge3Vect, edge3Point] );
  edgeData.push( [edge4Vect, edge4Point] );
  edgeData.push( [edge5Vect, edge5Point] );
  edgeData.push( [edge6Vect, edge6Point] );
  edgeData.push( [edge7Vect, edge7Point] );
  edgeData.push( [edge8Vect, edge8Point] );
  edgeData.push( [edge9Vect, edge9Point] );
  edgeData.push( [edge10Vect, edge10Point] );
  edgeData.push( [edge11Vect, edge11Point] );

  return edgeData;

}



VolumeNavigator.prototype.updateHitPointSpheres = function(){


  // removing the existing spheres from the scene
  for(var s=0; s<this.intersectionSpheres.length; s++){
    this.scene.remove(this.intersectionSpheres[s].mesh);
  }

  // if there is any...
  if(this.planePolygon){

    // reseting the array
    this.intersectionSpheres = [];

    for(var s=0; s<this.planePolygon.length; s++){

      var geometry = new THREE.SphereGeometry( this.boxDiagonal/50, 16, 16 );
      var material = new THREE.MeshBasicMaterial( {color: 0x00ff00} );
      var mesh = new THREE.Mesh( geometry, material );

      var currentSphere = {
        geometry: geometry,
        material: material,
        mesh: mesh
      }

      currentSphere.geometry.translate(
          this.planePolygon[s][0],
          this.planePolygon[s][1],
          this.planePolygon[s][2]
      );



      this.intersectionSpheres.push(currentSphere);
      this.scene.add( currentSphere.mesh );
    }


  }


}


/*
  Build the list of intersection point between the volume and the plane.
  Points stored in this.planePolygon
*/
VolumeNavigator.prototype.computeCubePlaneHitPoints = function(){
  var hitPoints = [];

  for(var i=0; i<this.cubeEdges.length; i++){
    var edge = this.cubeEdges[i];
    var tempHitPoint = this._getHitPoint(edge[0], edge[1]);


    // 1- We dont want to add infinite because it mean an orthogonal edge
    // from this one (still of the cube) will cross the plane in a single
    // point -- and this later case is easier to deal with.
    // 2- Check if hitpoint is within the cube.
    // 3- Avoid multiple occurence for the same hit point
    if( tempHitPoint && // may be null if contains Infinity as x, y or z
        this._isWithin(tempHitPoint))
    {
        var isAlreadyIn = false;

        // check if the point is already in the array
        for(var hp=0; hp<hitPoints.length; hp++ ){
          if( hitPoints[hp][0] == tempHitPoint[0] &&
              hitPoints[hp][1] == tempHitPoint[1] &&
              hitPoints[hp][2] == tempHitPoint[2]){
                isAlreadyIn = true;
                break;
              }
        }

        if(!isAlreadyIn){
          hitPoints.push(tempHitPoint);
        }
    }

  }

  // array are still easier to deal with
  this.planePolygon = hitPoints.length ? hitPoints : null;
}


/*
  Return true if the given point [x, y, z] is within the volume.
  (or on the edge)
*/
VolumeNavigator.prototype._isWithin = function(point){
  if(point[0] >=0 && point[0] <= this.outerBoxSize.xSize &&
     point[1] >=0 && point[1] <= this.outerBoxSize.ySize &&
     point[2] >=0 && point[2] <= this.outerBoxSize.zSize){

    return true;
  }else{
    return false;
  }
}

/*
  return a point in 3D space (tuple (x, y, z) ).
  vector and point define a "fixed vector" (droite affine)
  both are tuple (x, y, z)
  plane is the plane equation as a tuple (a, b, c, d)
*/
VolumeNavigator.prototype._getHitPoint = function(vector, point){

  // 3D affine system tuple:
  // ( (l, alpha), (m, beta), (n, gamma) )
  var affineSystem = this.vectorTools.affine3DFromVectorAndPoint(vector, point);


  // system resolution for t:
  // t = (a*l + b*m + c*n + d) / ( -1 * (a*alpha + b*beta + c*gamma) )

  var tNumerator = ( this.planeEquation.a* affineSystem[0][0] +
        this.planeEquation.b* affineSystem[1][0] +
        this.planeEquation.c* affineSystem[2][0] +
        this.planeEquation.d );

  var tDenominator = (-1) *
      ( this.planeEquation.a* affineSystem[0][1] +
        this.planeEquation.b* affineSystem[1][1] +
        this.planeEquation.c* affineSystem[2][1] );

  // TODO: be sure the cast to float is done
  // float conversion is mandatory to avoid euclidean div...
  //var t = float(tNumerator) / float(tDenominator);
  var t = tNumerator / tDenominator;


  // injection of t to the 3D affine system:
  var x =  affineSystem[0][0] + affineSystem[0][1] * t;
  var y =  affineSystem[1][0] + affineSystem[1][1] * t;
  var z =  affineSystem[2][0] + affineSystem[2][1] * t;


  // dont bother returning a vector containing Infinity, just return null.
  // (it will be spotted)
  if( x == Infinity ||
      y == Infinity ||
      z == Infinity)
  {
    return null;
  }

  // otherwise, return the 3D point
  return [x, y, z]
}



/*
  takes all the vertices of the intersection polygon and re-order the list so
  that the vertex are ordered cw
  (or ccw, we dont really care as long as it's no longer a mess)
*/
VolumeNavigator.prototype._orderPolygonPoints = function(){

  if(!this.planePolygon)
    return;

  var nbVertice = this.planePolygon.length;
  var center = this.getPolygonCenter();

  // create normailized vectors from center to each vertex of the polygon
  var normalizedRays = [];
  for(var v=0; v<nbVertice; v++){
    var currentRay = [
      center[0] - this.planePolygon[v][0],
      center[1] - this.planePolygon[v][1],
      center[2] - this.planePolygon[v][2]
    ];

    normalizedRays.push(this.vectorTools.normalize(currentRay));
  }

  // for each, we have .vertice (a [x, y, z] array) and .angle (rad angle to planePolygonWithAngles[0])
  var planePolygonWithAngles = [];

  // find the angle of each towards the first vertex
  planePolygonWithAngles.push({vertex: this.planePolygon[0], angle: 0})
  for(var v=1; v<nbVertice; v++){
    var cos = this.vectorTools.dotProduct(normalizedRays[0], normalizedRays[v]);
    var angle = Math.acos(cos);
    var currentPolygonNormal = this.vectorTools.crossProduct(normalizedRays[0], normalizedRays[v], false);
    var planeNormal = this.getPlaneNormal();
    var angleSign = this.vectorTools.dotProduct(currentPolygonNormal, planeNormal)>0? 1:-1;
    angle *= angleSign;

    planePolygonWithAngles.push({vertex: this.planePolygon[v], angle: angle})
  }

  // sort vertices based on their angle to [0]
  planePolygonWithAngles.sort(function(a, b){
    return a.angle - b.angle;
  });

  // make a array of vertex only (ordered)
  var orderedVertice = [];
  for(var v=0; v<nbVertice; v++){
    orderedVertice.push(planePolygonWithAngles[v].vertex);
  }

  // attribute the ordered array to this.planePolygo
  this.planePolygon = orderedVertice;
}


/*
  return the 3D center of the polygon.
  (Note: the polygon is formed by the intersection of the plane and the cube).
  Return: [x, y, z] Array
*/
VolumeNavigator.prototype.getPolygonCenter = function(){
  if(!this.planePolygon)
    return;

  var nbVertice = this.planePolygon.length;

  // find the center of the polygon
  var xAvg = 0;
  var yAvg = 0;
  var zAvg = 0;

  for(var v=0; v<nbVertice; v++){
    xAvg += this.planePolygon[v][0];
    yAvg += this.planePolygon[v][1];
    zAvg += this.planePolygon[v][2];
  }

  xAvg /= nbVertice;
  yAvg /= nbVertice;
  zAvg /= nbVertice;
  var center = [xAvg, yAvg, zAvg];

  return center;
}



/*
  initialize the polygon object
*/
VolumeNavigator.prototype.initPolygonTriangles = function(){
  this.polygonTriangles = {};

  // material
  this.polygonTriangles.material = new THREE.MeshLambertMaterial( {
      transparent: true,
      opacity: 0.2,
      color: 0xff0000,
      emissive: 0x000000,    // darkest color
      depthWrite: true,
      depthTest: true,
      side: THREE.DoubleSide,
  } );

  this.polygonTriangles.geometry = new THREE.Geometry();
  this.polygonTriangles.geometry.dynamic = true;

  this.polygonTriangles.mesh = new THREE.Mesh( this.polygonTriangles.geometry, this.polygonTriangles.material );

  this.scene.add( this.polygonTriangles.mesh );
}



VolumeNavigator.prototype.updatePolygonTriangles = function(){

  // there is no polygon to display
  if(!this.planePolygon){
    // remove from scene TODO



  }
  // there is a polygon intersection to display
  else{

    //this.scene.remove( this.polygonTriangles.mesh );

    // remove all existing triangles
    this.polygonTriangles.geometry.faces = [];
    this.polygonTriangles.geometry.vertices = [];

    // remove and rebuild (since we cannot change buffer size in webGL)
    this.scene.remove( this.polygonTriangles.mesh );
    this.initPolygonTriangles();

    var center = this.getPolygonCenter();

    // add the center to the geom
    this.polygonTriangles.geometry.vertices.push(
      new THREE.Vector3( center[0], center[1], center[2])
    );


    // add all the vertice to the geom
    for(v=0; v<this.planePolygon.length; v++){

      this.polygonTriangles.geometry.vertices.push(
        new THREE.Vector3(
          this.planePolygon[v][0],
          this.planePolygon[v][1],
          this.planePolygon[v][2]
        ));
    }

    // shaping the faces out of the vertice
    for(v=0; v<this.planePolygon.length - 1; v++){
      this.polygonTriangles.geometry.faces.push( new THREE.Face3( 0, v+1, v+2 ) );
    }

    // adding the last face manually (to close the loop)
    this.polygonTriangles.geometry.faces.push( new THREE.Face3( 0, this.planePolygon.length, 1 ) );

    // it was removed earlier
    this.scene.add( this.polygonTriangles.mesh );
  }




}
