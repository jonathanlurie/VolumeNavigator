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

    // callback when a slider is moved (still mouse down)
    this.onChangeCallback = null;

    // callback when a slider has finished to slide (mouse up)
    this.onFinishChangeCallback = null;


    // initialize THREE js elements necessary to create and render a scene
    this.init();

    // build the box context
    this.buildInnerBox();
    this.buildOuterBox();
    this.buildPlane();
    this.setupLighting();

    // initialize the UI (dat.gui)
    this.initGui();

    // just toinitialize in order to update dat.gui field
    this.updatePlaneEquation();

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
    this.innerBox.material = new THREE.MeshLambertMaterial( {
        transparent: true,
        opacity: 0.2,
        color: 0xc0059FF,
        emissive: 0x000000,
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide
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

    // add the inner box to scene
    this.scene.add( new THREE.Mesh( this.innerBox.geometry, this.innerBox.material ) );

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
    Build the plane out of 2 triangles.
    We will then be able to tilt and translate this plane.
*/
VolumeNavigator.prototype.buildPlane = function(){

    this.plane = {};

    // material
    this.plane.material = new THREE.MeshLambertMaterial( {
        transparent: true,
        opacity: 0.2,
        color: 0xFF0000,
        emissive: 0x000000,    // darkest color
        depthWrite: true,
        depthTest: true,
        side: THREE.DoubleSide,
    } );


    this.plane.geometry = new THREE.Geometry();

    // vertice declaration
    this.plane.geometry.vertices.push( new THREE.Vector3( -this.boxDiagonal/2, this.boxDiagonal/2, 0 ) ); // 0
    this.plane.geometry.vertices.push( new THREE.Vector3(  this.boxDiagonal/2, -this.boxDiagonal/2, 0 ) ); // 1
    this.plane.geometry.vertices.push( new THREE.Vector3(  this.boxDiagonal/2,  this.boxDiagonal/2, 0 ) ); // 2
    this.plane.geometry.vertices.push( new THREE.Vector3(  -this.boxDiagonal/2,  -this.boxDiagonal/2, 0 ) ); // 3

    // creation of triangles from existing vertice (using their index)
    this.plane.geometry.faces.push( new THREE.Face3( 0, 1, 2 ) );
    this.plane.geometry.faces.push( new THREE.Face3( 0, 3, 1 ) );

    this.plane.geometry.translate(
        this.outerBoxSize.xSize / 2,
        this.outerBoxSize.ySize / 2,
        this.outerBoxSize.zSize / 2
    );

    this.plane.geometry.computeFaceNormals();
    this.scene.add( new THREE.Mesh( this.plane.geometry, this.plane.material ) );

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
    planeTransFolder.add(this.guiValue.current, "xTrans", -this.boxDiagonal*1., this.boxDiagonal*1., 1).name("x")
        .onChange(function(value) {
            that.plane.geometry.translate(
                that.guiValue.previous.xTrans - that.guiValue.current.xTrans,
                that.guiValue.previous.yTrans - that.guiValue.current.yTrans,
                that.guiValue.previous.zTrans - that.guiValue.current.zTrans
            );

            that.guiValue.previous.xTrans = value;

            that.updatePlaneEquation();

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

    planeTransFolder.add(this.guiValue.current, "yTrans", -this.boxDiagonal*1., this.boxDiagonal*1., 1).name("y")
        .onChange(function(value) {
            that.plane.geometry.translate(
                that.guiValue.previous.xTrans - that.guiValue.current.xTrans,
                that.guiValue.previous.yTrans - that.guiValue.current.yTrans,
                that.guiValue.previous.zTrans - that.guiValue.current.zTrans
            );

            that.guiValue.previous.yTrans = value;

            that.updatePlaneEquation();

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

    planeTransFolder.add(this.guiValue.current, "zTrans", -this.boxDiagonal*1., this.boxDiagonal*1., 1).name("z")
        .onChange(function(value) {
            that.plane.geometry.translate(
                that.guiValue.previous.xTrans - that.guiValue.current.xTrans,
                that.guiValue.previous.yTrans - that.guiValue.current.yTrans,
                that.guiValue.previous.zTrans - that.guiValue.current.zTrans
            );

            that.guiValue.previous.zTrans = value;

            that.updatePlaneEquation();

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

            /*
            var rad = dif * Math.PI / 180.



            var currentCenter = {
                x: that.plane.geometry.boundingSphere.center.x,
                y: that.plane.geometry.boundingSphere.center.y,
                z: that.plane.geometry.boundingSphere.center.z
            }

            that.plane.geometry.translate(
                -currentCenter.x,
                -currentCenter.y,
                -currentCenter.z
            );

            that.plane.geometry.rotateX(rad);

            that.plane.geometry.translate(
                currentCenter.x,
                currentCenter.y,
                currentCenter.z
            );
            */

            that.guiValue.previous.xRot = value;

            //that.updatePlaneEquation();

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

            /*
            var rad = dif * Math.PI / 180.

            var currentCenter = {
                x: that.plane.geometry.boundingSphere.center.x,
                y: that.plane.geometry.boundingSphere.center.y,
                z: that.plane.geometry.boundingSphere.center.z
            }

            that.plane.geometry.translate(
                -currentCenter.x,
                -currentCenter.y,
                -currentCenter.z
            );

            that.plane.geometry.rotateY(rad);

            that.plane.geometry.translate(
                currentCenter.x,
                currentCenter.y,
                currentCenter.z
            );
            */

            that.guiValue.previous.yRot = value;

            //that.updatePlaneEquation();

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

            /*
            var rad = dif * Math.PI / 180.


            var currentCenter = {
                x: that.plane.geometry.boundingSphere.center.x,
                y: that.plane.geometry.boundingSphere.center.y,
                z: that.plane.geometry.boundingSphere.center.z
            }

            that.plane.geometry.translate(
                -currentCenter.x,
                -currentCenter.y,
                -currentCenter.z
            )

            that.plane.geometry.rotateZ(rad);

            that.plane.geometry.translate(
                currentCenter.x,
                currentCenter.y,
                currentCenter.z
            );
            */

            that.guiValue.previous.zRot = value;

            //that.updatePlaneEquation();

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

  console.log(this.gui.__controllers);

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
    Updates the plane equation, based on three points of the plane
*/
VolumeNavigator.prototype.updatePlaneEquation = function(){

    //this.planeEquation
    var P = this.plane.geometry.vertices[0];
    var Q = this.plane.geometry.vertices[1];
    var R = this.plane.geometry.vertices[2];



    var vPQ = new THREE.Vector3( 0, 0, 0 );
    vPQ.subVectors(Q, P);

    var vPR = new THREE.Vector3( 0, 0, 0 );
    vPR.subVectors(R, P);

    var n = new THREE.Vector3( 0, 0, 0 );
    n.crossVectors(vPQ, vPR);

    var eq = new THREE.Vector4(
        n.x,
        n.y,
        n.z,
        (-1) * (n.x*P.x + n.y*P.y + n.z*P.z)
    );

    eq.normalize();

    var roundFactor = 10000;

    this.planeEquation.a = Math.round(eq.x * roundFactor) / roundFactor;
    this.planeEquation.b = Math.round(eq.y * roundFactor) / roundFactor;
    this.planeEquation.c = Math.round(eq.z * roundFactor) / roundFactor;
    this.planeEquation.d = Math.round(eq.w * roundFactor) / roundFactor;

    this.guiValue.literalPlaneEquation.literal =
        this.planeEquation.a + "x + " +
        this.planeEquation.b + "y + " +
        this.planeEquation.c + "z + " +
        this.planeEquation.d + " = 0";


    // Display/refresh the plane normal and the point

    var n = this.getPlaneNormal();
    var p = this.getPlanePoint();

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

   this.plane.geometry.translate(
       currentCenter.x,
       currentCenter.y,
       currentCenter.z
   );

   this.updatePlaneEquation();

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

  this.updatePlaneEquation();
}
