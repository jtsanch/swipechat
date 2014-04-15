// Initial code by Borui Wang, updated by Graham Roth
// For CS247, Spring 2014

(function() {

  var cur_video_blob = null;
  var current_gif = null;
  var fb_instance;
  var auth;

  $(document).ready(function(){
    //First thing is initialize the app and ensure they are logged in...
    initialize_app();

    $("#home_view").hide();
    $("#login_prompt").show();
    $("#conversation_view").hide();

    $(".create_account_link").on("click", function(){
      register_prompt();
      console.log("create account");
    });
    $(".login_account_link").on("click", function(){
      login_prompt();
    });

    $("#login_user").on("click", function() {
      var email = $("#login_email").val();
      var password = $("#login_password").val();
      auth.login('password', {
        email: email,
        password: password,
        rememberMe: true
      });
    });

    $("#show_conversations").on("click", function(){
      $(".conversation_item").show();
      $(".friend_item").hide();
    });

    $("#show_friends").on("click", function(){
      $(".friend_item").show();
      $(".conversation_item").hide();
    });
  });
  /*
   * Navigation between the different divs and the action listeners below
   */
   function login_prompt(){
    $(".login_items").show();
    $(".register_items").hide();

  }

  function register_prompt(){
    $(".login_items").hide();
    $(".register_items").show();

    $("#register_user").on("click", function() {
      if($("#registration_password").val() == $("#registration_password_confirmation").val()){
          var email = $("#registration_email").val();
          var password = $("#registration_password").val();
          auth.createUser(email,password, function(error, user){
            if(!error){
              fb_instance.child('users').child(user.id).set({email:user.email});
              auth.login('password',{
                email: email,
                password: password,
                rememberMe: true
              });
            } else {
              alert(error);
            }
          });
      } else {
        alert("Passwords do not match!");
      }
    });
  }

  /*
   * Handlers for the conversation view
   */
   function load_home_view(user){

     $("#home_view").show();
     $("#login_prompt").hide();
     $("#conversation_view").hide();

     //this can be a unique list of ids of all the conversations
     var fb_conversations = fb_instance.child('users').child(user.id).child('conversations');

     var fb_instance_users = fb_instance.child('users');

     // listen to events
     fb_instance_users.on("value",function(snapshot){
        //we will just append this new user to the current list...
        if(snapshot.val())
          $.each(snapshot.val(), function(id, friend){
            add_user_list_item(friend.email, id, user);   
          }); 
      });
      
      fb_conversations.on("value",function(snapshot){
        //update the badge count and create a list item
        if(snapshot.val())
          $.each(snapshot.val(), function(id, conversation){
            add_conversation_list_item(conversation, user);
          });
      });
   }
   
   function add_user_list_item(email, id, user){
      var user_div = document.createElement("li");
      user_div.className ='list-group-item list-group-item-info';
      user_div.innerHTML = email;
      $(user_div).on("click", function(){

        create_conversation(id,user);

      });
      $("#current_friends").append(user_div);
   }

   function add_conversation_list_item(conversation, user){
      var conversation_div = document.createElement('div');
      conversation_div.className = 'list_group_item';
      var conversation = fb_instance.child('conversations').child(conversation.id);
      conversation.on("value",function(snapshot){
        var convo = snapshot.val();
        var name_to_display = convo.responder;
        if(name_to_display == user.email){
          name_to_display = convo.starter;
        }
        var message = convo.text.substring(0,20) + "...";
        conversation_div.innerHTML = name_to_display + "<br />" + message;
        conversation_div.on("click", function(){
          load_conversation_view(id, user);
        });
        $("#conversations").appendChild(conversation_div); 
      });
   }

  /*
   * Handlers for the conversation view
   */
   function create_conversation(responder_id, user){
    // increment the counter
    fb_instance.child('counter_conversation').transaction(function(currentValue) {
        return (currentValue||0) + 1
    }, function(err, committed, ss) {
      if( err ) {
           setError(err);
        }
        else if( committed ) {
           // if counter update succeeds, then create record
           // probably want a recourse for failures too
           var fb_new_conversation = fb_instance.child('conversations').child(ss.val());
           fb_new_conversation.child('users').set({starter:user.id, responder:responder_id});
           var fb_starter_ref      = fb_instance.child('users').child(user.id).child('conversations').push({id:ss.val()});
           var fb_responder_ref    = fb_instance.child('users').child(responder_id).child('conversations').push({id:ss.val()});
           fb_new_conversation.set({seen:"Not seen yet"});
           load_conversation_view(ss.val(), user);
        }
    });
   }

  function load_conversation_view(conversation_id, user){
    $("#home_view").hide();
    $("#login_prompt").hide();
    $("#conversation_view").show();
    $("#messages").empty();

    var fb_conversation = fb_instance.child('conversations').child(conversation_id);
    fb_conversation.update({seen:"Seen at"+(new Date())});

    //Load all the messages as they come in...
    fb_conversation.child("messages").on('child_added', function(snapshot){
        var message = snapshot.val();
        var color = "#82CAFF";
        if(message.name == user.email){
          color = "black";
        }
        $("#messages").append("<li class='list_group_item' style='color:"+color+"'>"+new Date(message.time)+"<br/>"+
                              message.text+"</li>");
        scroll_to_bottom(0);      
      });
  
      fb_conversation.on('value', function(snapshot){
        $.each(snapshot.val(),function(id,message){
          if(id == "seen"){
            $("#seen_div").html(message);
          } else {
            if(message){
              var color = "#82CAFF";
              if(message.name == user.email){
                color = "black";
              }
              $("#messages").append("<div class='list_group_item' style='color:"+color+"'>"+
                    (new Date(message.time))+"<br/>"+message.text+"</div>");
            }
          }
        });
      });
     
     //So they can swipe to the right to add a video gif
      $(document).on( "swipeleft", "ui-page", function( event ) {
        $('#hidden_video_input').trigger('click');   
      });

       //When they actually want to send the message
       $('#message_send').on('click',function(){
            var name = user.email;
            var text = $('#message_input').val();
            if(text.length != ''){
              fb_conversation.child('messages').push({name:name, text:text, time: new Date().getTime() });
              if(current_gif)
                fb_conversation.child('current_gif').push(current_gif);
            }
        });

        fb_conversation.child('current_gif').on('child_changed', function(snapshot){
          if(snapshot.val()){
            var video = document.createElement("video");
            video.autoplay = true;
            video.controls = false; // optional
            video.loop = true;
            video.width = 120;
           
            var source = document.createElement("source");
            source.src =  URL.createObjectURL(base64_to_blob(snapshot.val()));
            source.type =  "video/webm";

            video.appendChild(source);

            $("#current_gif_display").innerHTML = video;
            scroll_to_bottom(0); 
          }
        });
  }

  $("#video_reply #hidden_video_input").on("change",function(){
    var files = this.files;
    var video_width= 160;
    var video_height= 120;
    var video = document.createElement('video');
    video = mergeProps(video, {
      controls: false,
      width: video_width,
      height: video_height,
      src: URL.createObjectURL(files[files.length-1].slice())
    });
    video.play();
    $("current_gif_display").innerHTML = video;
    blob_to_base64(files[files.length-1].slice(),function(b64_data){
      current_gif = b64_data;
    });
  });

 function initialize_app(){
     fb_instance = new Firebase("https://sizzling-fire-6665.firebaseio.com");
     auth = new FirebaseSimpleLogin(fb_instance, function(error, user) {
        if (error) {
          // an error occurred while attempting login
          console.log(error);
        } else if (user) {
          //user is logged in
          console.log(user);
          load_home_view(user);
        } else {
          $(".login_items").show();
          $(".register_items").hide();
        }
      });
  }



  function scroll_to_bottom(wait_time){
    // scroll to bottom of div
    setTimeout(function(){
      $("html, body").animate({ scrollTop: $(document).height() }, 200);
    },wait_time);
  }

 

  // some handy methods for converting blob to base 64 and vice versa
  // for performance bench mark, please refer to http://jsperf.com/blob-base64-conversion/5
  // note useing String.fromCharCode.apply can cause callstack error
  var blob_to_base64 = function(blob, callback) {
    var reader = new FileReader();
    reader.onload = function() {
      var dataUrl = reader.result;
      var base64 = dataUrl.split(',')[1];
      callback(base64);
    };
    reader.readAsDataURL(blob);
  };

  var base64_to_blob = function(base64) {
    var binary = atob(base64);
    var len = binary.length;
    var buffer = new ArrayBuffer(len);
    var view = new Uint8Array(buffer);
    for (var i = 0; i < len; i++) {
      view[i] = binary.charCodeAt(i);
    }
    var blob = new Blob([view]);
    return blob;
  };

})();
